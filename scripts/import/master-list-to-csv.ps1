<#
.SYNOPSIS
    Convert "System Master List.xlsx" → CitroTechnician-import-ready CSV.

.DESCRIPTION
    One-off helper to seed the app with the Master List spreadsheet. Reads
    the .xlsx via Excel COM, normalizes each row, and writes a CSV whose
    headers match the field aliases recognized by /settings/import.

    Two columns deliberately come out blank because the spreadsheet
    doesn't have them — the user fills these in Excel before importing:
      - product   (System / Spray)
      - lastServiceDate for rows that haven't had their first annual yet

.EXAMPLE
    pwsh ./scripts/import/master-list-to-csv.ps1
    # Reads ~/Downloads/System Master List.xlsx
    # Writes ~/Downloads/CitroTechnician-import.csv

.EXAMPLE
    pwsh ./scripts/import/master-list-to-csv.ps1 -InputPath "C:\path\to\source.xlsx" -OutputPath "C:\path\to\out.csv"

.NOTES
    Requires Excel installed (uses the COM automation interface).
    Tested against the Master List shape from 2026-04-27 (17 cols,
    title row at R1, headers at R2, data R3..R59).
#>
[CmdletBinding()]
param(
    [string]$InputPath  = (Join-Path $env:USERPROFILE 'Downloads\System Master List.xlsx'),
    [string]$OutputPath = (Join-Path $env:USERPROFILE 'Downloads\CitroTechnician-import.csv')
)

if (-not (Test-Path $InputPath)) {
    Write-Error "Input file not found: $InputPath"
    exit 1
}

# ---------- Parsing helpers ------------------------------------------------

function Parse-Address {
    param([string]$Raw)
    # Returns a hashtable with address / city / state / zip extracted from
    # a free-form one-line address like "1000 Marlene St, Incline Village Nv"
    # or "650 Lachman Lane, Los Angeles, CA 90272, US".
    $s = ([string]$Raw).Trim()
    if (-not $s) { return @{ address = ''; city = ''; state = ''; zip = '' } }

    # Strip trailing country tag and trailing commas.
    $s = $s -replace ',?\s*US(A)?\s*$', ''
    $s = ($s -replace ',\s*$', '').Trim()

    # Pull a 5- or 5+4-digit zip if present at the end.
    $zip = ''
    if ($s -match '\b(\d{5}(-\d{4})?)\s*$') {
        $zip = $Matches[1]
        $s = $s.Substring(0, $s.Length - $Matches[0].Length).Trim()
        $s = ($s -replace ',\s*$', '').Trim()
    }

    # Pull a 2-letter state if present at the end. Backtracking works because
    # the regex anchors to end-of-string so "St Helena Ca" picks Ca, not St.
    $state = ''
    if ($s -match '(^|[\s,])([A-Za-z]{2})\s*$') {
        $state = $Matches[2].ToUpper()
        $s = $s.Substring(0, $s.Length - $Matches[2].Length).Trim()
        $s = ($s -replace ',\s*$', '').Trim()
    }

    # Split on commas — last segment is city, everything before is address.
    $parts = @($s -split ',\s*')
    if ($parts.Count -ge 2) {
        $city = $parts[-1].Trim()
        $address = ($parts[0..($parts.Count - 2)] -join ', ').Trim()
    } else {
        # No comma: best-effort. If we already pulled a state/zip, the
        # remainder is the street with city tacked on the end (e.g.
        # "417 St Andrews Drive Napa"). User will fix in CSV.
        $city = ''
        $address = $s.Trim()
    }

    return @{ address = $address; city = $city; state = $state; zip = $zip }
}

function Normalize-Region {
    param([string]$Raw, [string]$State)
    $r = ([string]$Raw).Trim().ToLower()
    switch -Regex ($r) {
        '^norcal'    { return 'NORCAL' }
        '^socal'     { return 'SOCAL' }
        '^nevada'    { return 'OTHER' }
        '^texas'     { return 'OTHER' }
        '^other'     { return 'OTHER' }
        default {
            # Fall back to state code: CA = blank (let importer infer
            # from zip), anything else = OTHER.
            if ($State -and $State -ne 'CA') { return 'OTHER' }
            return ''
        }
    }
}

function Parse-CompletedDate {
    param($Raw, [string]$Done)
    if (([string]$Done).Trim().ToLower() -ne 'y') { return '' }
    if ($null -eq $Raw -or $Raw -eq '') { return '' }
    if ($Raw -is [double]) {
        return [DateTime]::FromOADate($Raw).ToString('yyyy-MM-dd')
    }
    if ($Raw -is [datetime]) {
        return $Raw.ToString('yyyy-MM-dd')
    }
    # String date — try plain parse.
    [datetime]$dt = 0
    if ([datetime]::TryParse([string]$Raw, [ref]$dt)) {
        return $dt.ToString('yyyy-MM-dd')
    }
    return ''
}

function Parse-Money {
    param([string]$Raw)
    $r = ([string]$Raw).Trim().ToLower()
    if (-not $r -or $r -eq 'waived') { return '' }
    $clean = $r -replace '[$,\s]', ''
    [double]$n = 0
    if ([double]::TryParse($clean, [ref]$n)) { return [string]$n }
    return ''
}

function Parse-CyclesPlanned {
    param([string]$Raw)
    $r = ([string]$Raw).Trim().ToLower()
    if ($r -match '^\s*(\d+)\s*year') { return $Matches[1] }
    if ($r -match '^\s*(\d+)\s*$')    { return $Matches[1] }
    return ''
}

function Merge-Notes {
    param([string]$NotesA, [string]$NotesB)
    $bits = @()
    if ($NotesA -and $NotesA.Trim()) { $bits += $NotesA.Trim() }
    if ($NotesB -and $NotesB.Trim()) { $bits += $NotesB.Trim() }
    return ($bits -join "`n`n")
}

function Derive-PropertyName {
    param([string]$CustomerName, [string]$Address)
    # Strip "(Flameguard)" or other paren qualifiers from name. If the name
    # contains a property qualifier ("Personal home", "spec home"), use it.
    # Otherwise fall back to the street part of the address.
    $n = ([string]$CustomerName).Trim()
    if ($n -match '(?i)(personal home|spec home|residence|estate|vineyard|ranch|villa|winery)') {
        # Use the customer name as-is — they've already labeled the property.
        return $n
    }
    # Default to the street address (everything before first comma).
    $first = ([string]$Address).Split(',', 2)[0].Trim()
    if ($first) { return $first }
    return $n
}

function Format-Phone {
    param([string]$Raw)
    $digits = ([string]$Raw) -replace '\D', ''
    if ($digits.Length -eq 10) {
        return "({0}) {1}-{2}" -f $digits.Substring(0,3), $digits.Substring(3,3), $digits.Substring(6,4)
    }
    if ($digits.Length -eq 11 -and $digits[0] -eq '1') {
        return "({0}) {1}-{2}" -f $digits.Substring(1,3), $digits.Substring(4,3), $digits.Substring(7,4)
    }
    return ([string]$Raw).Trim()
}

# ---------- Read source ----------------------------------------------------

Write-Host "Reading $InputPath..."
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$rows = @()
$skipped = 0
$completedCount = 0
$pendingCount = 0

try {
    $wb = $excel.Workbooks.Open($InputPath, 0, $true)
    $ws = $wb.Sheets.Item(1)
    $rng = $ws.UsedRange
    $maxRow = $rng.Rows.Count

    # Data starts at row 3 (R1 = title, R2 = headers).
    for ($r = 3; $r -le $maxRow; $r++) {
        $name        = [string]$ws.Cells.Item($r, 1).Value2
        $addrRaw     = [string]$ws.Cells.Item($r, 2).Value2
        $regionRaw   = [string]$ws.Cells.Item($r, 3).Value2
        $phoneRaw    = [string]$ws.Cells.Item($r, 4).Value2
        $emailRaw    = [string]$ws.Cells.Item($r, 5).Value2
        $doneRaw     = [string]$ws.Cells.Item($r, 6).Value2
        $dateRaw     =          $ws.Cells.Item($r, 7).Value2
        $amountRaw   = [string]$ws.Cells.Item($r, 8).Value2
        $termsRaw    = [string]$ws.Cells.Item($r, 10).Value2
        $notesRaw    = [string]$ws.Cells.Item($r, 11).Value2
        $maintRaw    = [string]$ws.Cells.Item($r, 12).Value2

        # Skip empty rows and explicit TBD placeholders.
        if (-not $name -and -not $addrRaw) { $skipped++; continue }
        if ($name.Trim().ToUpper() -eq 'TBD') { $skipped++; continue }

        $parsed = Parse-Address -Raw $addrRaw
        $region = Normalize-Region -Raw $regionRaw -State $parsed.state
        $lastServiceDate = Parse-CompletedDate -Raw $dateRaw -Done $doneRaw
        $contractValue = Parse-Money -Raw $amountRaw
        $cyclesPlanned = Parse-CyclesPlanned -Raw $termsRaw
        $officeNotes = Merge-Notes -NotesA $notesRaw -NotesB $maintRaw
        $propertyName = Derive-PropertyName -CustomerName $name -Address $parsed.address
        $phone = Format-Phone -Raw $phoneRaw

        if ($lastServiceDate) { $completedCount++ } else { $pendingCount++ }

        $rows += [pscustomobject][ordered]@{
            customerName     = $name.Trim()
            propertyName     = $propertyName
            address          = $parsed.address
            city             = $parsed.city
            state            = $parsed.state
            zip              = $parsed.zip
            product          = ''       # ← FILL: System / Spray
            contractValue    = $contractValue
            lastServiceDate  = $lastServiceDate
            customerEmail    = ([string]$emailRaw).Trim()
            customerPhone    = $phone
            region           = $region
            cyclesPlanned    = $cyclesPlanned
            officeNotes      = $officeNotes
        }
    }
} finally {
    if ($wb) { $wb.Close($false) }
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

# ---------- Write output ---------------------------------------------------

$rows | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8

# ---------- Report ---------------------------------------------------------

$missingProduct = ($rows | Where-Object { -not $_.product }).Count
$missingDate    = ($rows | Where-Object { -not $_.lastServiceDate }).Count
$missingCity    = ($rows | Where-Object { -not $_.city }).Count
$missingState   = ($rows | Where-Object { -not $_.state }).Count

Write-Host ""
Write-Host "  [OK] Wrote $($rows.Count) rows to $OutputPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Conversion summary:" -ForegroundColor Cyan
Write-Host "    Total data rows in source : $($rows.Count + $skipped)"
Write-Host "    Skipped (blank/TBD)       : $skipped"
Write-Host "    Imported                  : $($rows.Count)"
Write-Host "      -with last-service date: $completedCount"
Write-Host "      -pending first service : $pendingCount"
Write-Host ""
Write-Host "  Manual fill needed (open the CSV in Excel):" -ForegroundColor Yellow
Write-Host "    product (System / Spray)  : $missingProduct rows blank"
Write-Host "    lastServiceDate           : $missingDate rows blank (no install/service date)"
Write-Host ""
if ($missingCity -gt 0 -or $missingState -gt 0) {
    Write-Host "  Address parsing fallbacks:" -ForegroundColor Yellow
    Write-Host "    rows missing city : $missingCity"
    Write-Host "    rows missing state: $missingState"
    Write-Host "    (review address column manually for these)"
    Write-Host ""
}
Write-Host "  Next steps:" -ForegroundColor Cyan
Write-Host "    1. Open $OutputPath in Excel"
Write-Host "    2. Fill the blank product / lastServiceDate cells"
Write-Host "    3. Save as CSV (UTF-8)"
Write-Host "    4. Upload at /settings/import in the app"
