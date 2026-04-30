<#
.SYNOPSIS
    Build a polished Excel template seeded from "System Master List.xlsx".

.DESCRIPTION
    Reads the source Master List and writes a styled workbook with:
      - "Data" sheet whose header row matches the import field labels
        exactly, so saving the sheet as CSV uploads cleanly at
        /settings/import. Pre-populated from the source where possible.
      - "Instructions" sheet explaining each column and the workflow.
      - "Lookups" sheet (hidden) backing the data-validation dropdowns.

    Cells that the source can't provide (Product, Sq ft, install date for
    pending rows, Cycle index for repeats) are highlighted yellow so the
    team can see at a glance what still needs filling.

    Header coverage matches src/lib/csv-import.ts FIELD_ORDER, so every
    import field — including Cycle index / Cycles planned (1st-year /
    2nd-year tags), phone, email, region — has a column.

.EXAMPLE
    pwsh ./scripts/import/build-master-template.ps1
    # Reads ~/Downloads/System Master List.xlsx
    # Writes ~/Downloads/CitroTechnician-Master-Template.xlsx

.NOTES
    Requires Excel installed (uses COM automation).
    The data parsers mirror master-list-to-csv.ps1 — keep them in sync if
    you ever change one. Re-run after the source list is touched.
#>
[CmdletBinding()]
param(
    [string]$InputPath  = (Join-Path $env:USERPROFILE 'Downloads\System Master List.xlsx'),
    [string]$OutputPath = (Join-Path $env:USERPROFILE 'Downloads\CitroTechnician-Master-Template.xlsx')
)

if (-not (Test-Path $InputPath)) {
    Write-Error "Input file not found: $InputPath"
    exit 1
}

# PS+Excel-COM has flaky Variant overload resolution on Range.Value2 when
# the assigned value is a non-string. Force the dispatch path by writing
# strings (with NumberFormat doing the visual heavy-lifting) and using
# .Formula for numerics so Excel evaluates them back to a number.
function Set-CellValue {
    param($Cell, $Value)
    if ($null -eq $Value) { return }
    if ($Value -is [string]) {
        if ($Value.Length -eq 0) { return }
        $Cell.Value2 = [string]$Value
        return
    }
    if ($Value -is [datetime]) {
        # OA-date as a numeric string, then NumberFormat will render it.
        $Cell.Formula = [string]([double]$Value.ToOADate())
        return
    }
    if ($Value -is [bool]) {
        $Cell.Value2 = if ($Value) { 'TRUE' } else { 'FALSE' }
        return
    }
    # Numerics (int/double/decimal/etc.) → write the literal as a formula so
    # Excel parses it as a number under whatever NumberFormat we've set.
    $Cell.Formula = [string]([double]$Value)
}

# ---------- Parsing helpers (mirror master-list-to-csv.ps1) ---------------

function Parse-Address {
    param([string]$Raw)
    $s = ([string]$Raw).Trim()
    if (-not $s) { return @{ address = ''; city = ''; state = ''; zip = '' } }
    $s = $s -replace ',?\s*US(A)?\s*$', ''
    $s = ($s -replace ',\s*$', '').Trim()
    $zip = ''
    if ($s -match '\b(\d{5}(-\d{4})?)\s*$') {
        $zip = $Matches[1]
        $s = $s.Substring(0, $s.Length - $Matches[0].Length).Trim()
        $s = ($s -replace ',\s*$', '').Trim()
    }
    $state = ''
    if ($s -match '(^|[\s,])([A-Za-z]{2})\s*$') {
        $state = $Matches[2].ToUpper()
        $s = $s.Substring(0, $s.Length - $Matches[2].Length).Trim()
        $s = ($s -replace ',\s*$', '').Trim()
    }
    $parts = @($s -split ',\s*')
    if ($parts.Count -ge 2) {
        $city = $parts[-1].Trim()
        $address = ($parts[0..($parts.Count - 2)] -join ', ').Trim()
    } else {
        $city = ''
        $address = $s.Trim()
    }
    return @{ address = $address; city = $city; state = $state; zip = $zip }
}

function Normalize-Region {
    param([string]$Raw, [string]$State)
    $r = ([string]$Raw).Trim().ToLower()
    switch -Regex ($r) {
        '^norcal'  { return 'NORCAL' }
        '^socal'   { return 'SOCAL' }
        '^nevada'  { return 'OTHER' }
        '^texas'   { return 'OTHER' }
        '^other'   { return 'OTHER' }
        default {
            if ($State -and $State -ne 'CA') { return 'OTHER' }
            return ''
        }
    }
}

function Parse-CompletedDate {
    param($Raw, [string]$Done)
    if (([string]$Done).Trim().ToLower() -ne 'y') { return $null }
    if ($null -eq $Raw -or $Raw -eq '') { return $null }
    if ($Raw -is [double])   { return [DateTime]::FromOADate($Raw) }
    if ($Raw -is [datetime]) { return $Raw }
    [datetime]$dt = 0
    if ([datetime]::TryParse([string]$Raw, [ref]$dt)) { return $dt }
    return $null
}

function Parse-Money {
    param([string]$Raw)
    $r = ([string]$Raw).Trim().ToLower()
    if (-not $r -or $r -eq 'waived') { return $null }
    $clean = $r -replace '[$,\s]', ''
    [double]$n = 0
    if ([double]::TryParse($clean, [ref]$n)) { return $n }
    return $null
}

function Parse-CyclesPlanned {
    param([string]$Raw)
    $r = ([string]$Raw).Trim().ToLower()
    if ($r -match '^\s*(\d+)\s*year') { return [int]$Matches[1] }
    if ($r -match '^\s*(\d+)\s*$')    { return [int]$Matches[1] }
    return $null
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
    $n = ([string]$CustomerName).Trim()
    if ($n -match '(?i)(personal home|spec home|residence|estate|vineyard|ranch|villa|winery)') {
        return $n
    }
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

# ---------- Read source ---------------------------------------------------

Write-Host "Reading $InputPath..."
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

$rows = @()
$skipped = 0

try {
    $wb = $excel.Workbooks.Open($InputPath, 0, $true)
    $ws = $wb.Sheets.Item(1)
    $rng = $ws.UsedRange
    $maxRow = $rng.Rows.Count

    # Source layout: row 1 = title, row 2 = headers, rows 3..N = data.
    for ($r = 3; $r -le $maxRow; $r++) {
        $name      = [string]$ws.Cells.Item($r, 1).Value2
        $addrRaw   = [string]$ws.Cells.Item($r, 2).Value2
        $regionRaw = [string]$ws.Cells.Item($r, 3).Value2
        $phoneRaw  = [string]$ws.Cells.Item($r, 4).Value2
        $emailRaw  = [string]$ws.Cells.Item($r, 5).Value2
        $doneRaw   = [string]$ws.Cells.Item($r, 6).Value2
        $dateRaw   =          $ws.Cells.Item($r, 7).Value2
        $amountRaw = [string]$ws.Cells.Item($r, 8).Value2
        $termsRaw  = [string]$ws.Cells.Item($r, 10).Value2
        $notesRaw  = [string]$ws.Cells.Item($r, 11).Value2
        $maintRaw  = [string]$ws.Cells.Item($r, 12).Value2

        if (-not $name -and -not $addrRaw) { $skipped++; continue }
        if ($name.Trim().ToUpper() -eq 'TBD') { $skipped++; continue }

        $parsed   = Parse-Address -Raw $addrRaw
        $region   = Normalize-Region -Raw $regionRaw -State $parsed.state
        $svcDate  = Parse-CompletedDate -Raw $dateRaw -Done $doneRaw
        $value    = Parse-Money -Raw $amountRaw
        $cycles   = Parse-CyclesPlanned -Raw $termsRaw
        $notes    = Merge-Notes -NotesA $notesRaw -NotesB $maintRaw
        $prop     = Derive-PropertyName -CustomerName $name -Address $parsed.address
        $phone    = Format-Phone -Raw $phoneRaw
        $done     = ([string]$doneRaw).Trim().ToUpper()

        $rows += [pscustomobject][ordered]@{
            customerName     = $name.Trim()
            propertyName     = $prop
            address          = $parsed.address
            city             = $parsed.city
            state            = if ($parsed.state) { $parsed.state } else { 'CA' }
            zip              = $parsed.zip
            product          = ''                 # team fills: System / Spray
            sqft             = $null              # team fills
            contractValue    = $value
            lastServiceDate  = $svcDate           # null when install pending
            intervalMonths   = 12
            customerEmail    = ([string]$emailRaw).Trim()
            customerPhone    = $phone
            region           = $region
            cycleIndex       = 0                  # default install; team adjusts for Y1+/Y2+
            cyclesPlanned    = if ($cycles) { $cycles } else { 2 }
            officeNotes      = $notes
            sourceRow        = $r
            installDone      = if ($done -eq 'Y') { 'Y' } else { 'N' }
        }
    }
} finally {
    if ($wb) { $wb.Close($false) }
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

Write-Host "  Parsed $($rows.Count) data rows ($skipped skipped)"

# ---------- Build template -------------------------------------------------

Write-Host "Building $OutputPath..."

if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.ScreenUpdating = $false

# Style constants.
$NAVY        = 2042909         # RGB(29, 53, 87)  — dark navy
$NAVY_LIGHT  = 13551816        # RGB(200, 215, 230)
$YELLOW      = 8454143         # RGB(255, 248, 220) — soft "needs fill"
$GRAY_BORDER = 11250603        # RGB(171, 171, 171)
$GRAY_HEADER = 5526612         # RGB(84, 84, 84)
$WHITE       = 16777215

# Column definitions for the Data sheet. The "header" labels match
# FIELD_META labels in src/lib/csv-import.ts so importer auto-detects.
$cols = @(
    @{ field = 'customerName';    header = 'Customer';            req = $true;  width = 28; format = '@' }
    @{ field = 'propertyName';    header = 'Property';            req = $true;  width = 28; format = '@' }
    @{ field = 'address';         header = 'Address';             req = $true;  width = 32; format = '@' }
    @{ field = 'city';            header = 'City';                req = $true;  width = 18; format = '@' }
    @{ field = 'state';           header = 'State';               req = $false; width = 7;  format = '@'; validation = 'state' }
    @{ field = 'zip';             header = 'ZIP';                 req = $false; width = 9;  format = '@' }
    @{ field = 'product';         header = 'Product';             req = $true;  width = 11; format = '@'; validation = 'product' }
    @{ field = 'sqft';            header = 'Sq ft';               req = $true;  width = 10; format = '#,##0' }
    @{ field = 'contractValue';   header = 'Contract value';      req = $false; width = 14; format = '$#,##0' }
    @{ field = 'lastServiceDate'; header = 'Last service date';   req = $true;  width = 14; format = 'yyyy-mm-dd' }
    @{ field = 'intervalMonths';  header = 'Interval (months)';   req = $false; width = 9;  format = '0' }
    @{ field = 'customerEmail';   header = 'Customer email';      req = $false; width = 28; format = '@' }
    @{ field = 'customerPhone';   header = 'Customer phone';      req = $false; width = 16; format = '@' }
    @{ field = 'region';          header = 'Region';              req = $false; width = 9;  format = '@'; validation = 'region' }
    @{ field = 'cycleIndex';      header = 'Cycle index';         req = $false; width = 7;  format = '0';  validation = 'cycleIndex' }
    @{ field = 'cyclesPlanned';   header = 'Cycles planned';      req = $false; width = 8;  format = '0';  validation = 'cyclesPlanned' }
    @{ field = 'officeNotes';     header = 'Office notes';        req = $false; width = 50; format = '@' }
    # Helper columns — won't be picked up by the importer (unknown header).
    @{ field = 'sourceRow';       header = 'Source row #';        req = $false; width = 9;  format = '0';   helper = $true }
    @{ field = 'installDone';     header = 'Install done?';       req = $false; width = 10; format = '@';  helper = $true }
    @{ field = 'verifiedBy';      header = 'Verified by';         req = $false; width = 12; format = '@';  helper = $true }
    @{ field = 'verifiedDate';    header = 'Verified date';       req = $false; width = 12; format = 'yyyy-mm-dd'; helper = $true }
    @{ field = 'annualsRemaining';header = 'Annuals remaining';   req = $false; width = 10; format = '0';          helper = $true; formula = $true }
)

# Per-header comment text. Hover the small triangle in the header to read.
$headerComments = @{
    'lastServiceDate'  = "The date of the most recent COMPLETED visit at this property — install or last annual.`r`n`r`nLeave blank if the install hasn't happened yet (we'll fill it once it does)."
    'product'          = "System or Spray. Required for every row."
    'sqft'             = "Square footage being treated. Required."
    'cycleIndex'       = "What's been done at this property so far?`r`n`r`n  0 = install only (or install pending)`r`n  1 = Year 1 annual is the most recent`r`n  2 = Year 2 annual is the most recent`r`n  3 = Year 3, etc.`r`n`r`nDefault is 0. Bump only if the property is mid-agreement and at least one annual has happened. See the Instructions tab for the decision tree."
    'cyclesPlanned'    = "How many annual inspections did the customer sign up for in their contract?`r`n`r`n  2 = standard 2-year (default)`r`n  1 = 1-year`r`n  3 = 3-year`r`n`r`nThe source 'Terms' column was mapped automatically: '2 year' -> 2."
    'sourceRow'        = "The row number in the original 'System Master List.xlsx'.`r`n`r`nUse it to cross-check against the source spreadsheet during verification. Not imported — for your reference only."
    'installDone'      = "Y/N copied from the source 'Completed?' column.`r`n`r`nIf N and Last service date is blank, the install hasn't happened yet — that row can't import until you fill the install date."
    'verifiedBy'       = "Your initials when the row has been audited and is ready to import."
    'verifiedDate'     = "The date you signed off on this row."
    'annualsRemaining' = "Auto-calculated: Cycles planned minus Cycle index.`r`n`r`nHow many more annual inspections the customer is owed under the agreement. 0 means the agreement is complete."
}

try {
    $bk = $xl.Workbooks.Add()
    while ($bk.Sheets.Count -gt 1) { $bk.Sheets.Item($bk.Sheets.Count).Delete() }
    # Capture the default sheet so we can drop it after our own are added
    # (Workbooks.Add requires at least one sheet to exist).
    $defaultSheet = $bk.Sheets.Item(1)

    # ----- Sheet: Lookups (hidden) — feeds data validation -----
    $luSheet = $bk.Sheets.Add()
    $luSheet.Name = 'Lookups'
    $luSheet.Cells.Item(1,1).Value2 = 'Product'
    $luSheet.Cells.Item(2,1).Value2 = 'System'
    $luSheet.Cells.Item(3,1).Value2 = 'Spray'
    $luSheet.Cells.Item(1,2).Value2 = 'Region'
    $luSheet.Cells.Item(2,2).Value2 = 'NORCAL'
    $luSheet.Cells.Item(3,2).Value2 = 'SOCAL'
    $luSheet.Cells.Item(4,2).Value2 = 'OTHER'
    $luSheet.Cells.Item(1,3).Value2 = 'State'
    $states = @('CA','NV','OR','WA','AZ','TX','ID','UT')
    for ($i = 0; $i -lt $states.Length; $i++) { $luSheet.Cells.Item($i + 2, 3).Value2 = $states[$i] }
    $luSheet.Cells.Item(1,4).Value2 = 'CycleIndex'
    for ($i = 0; $i -le 5; $i++) { Set-CellValue -Cell $luSheet.Cells.Item($i + 2, 4) -Value $i }
    $luSheet.Cells.Item(1,5).Value2 = 'CyclesPlanned'
    for ($i = 1; $i -le 5; $i++) { Set-CellValue -Cell $luSheet.Cells.Item($i + 1, 5) -Value $i }
    $luSheet.Range('A1:E1').Font.Bold = $true
    $luSheet.Visible = 2  # xlSheetVeryHidden — can't unhide via the UI, only code

    # ----- Sheet: Instructions -----
    $insSheet = $bk.Sheets.Add()
    $insSheet.Name = 'Instructions'

    $insRows = @(
        @{ text = 'CitroTechnician Master Import Template'; style = 'title' }
        @{ text = ''; style = 'spacer' }
        @{ text = "Source: $InputPath"; style = 'meta' }
        @{ text = "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"; style = 'meta' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'What this is'; style = 'h2' }
        @{ text = 'This is the working copy of the System Master List, reformatted to match what CitroTechnician needs to import. Your job: walk every row, fill the gaps, mark each one verified. When the team is done, we save it as CSV and load it into the app — that becomes our system of record going forward.'; style = 'body' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'Before you start'; style = 'h2' }
        @{ text = '* The "Data" tab is where you work. Each row = one job at one property for one customer. If a customer has 3 properties, expect 3 rows.'; style = 'body' }
        @{ text = '* Headers with a * are required. Cells highlighted YELLOW are blank in the source and must be filled before that row can import.'; style = 'body' }
        @{ text = '* Do NOT rename column headers — the importer matches by name.'; style = 'body' }
        @{ text = '* Hover any header (look for a small red triangle in the corner) for a quick tooltip on what to put in that column.'; style = 'body' }
        @{ text = '* Save your work often.'; style = 'body' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'The two questions you answer for every row'; style = 'h2' }
        @{ text = 'Q1.  What has been done at this property so far?  --> fills "Last service date" and "Cycle index"'; style = 'body' }
        @{ text = 'Q2.  How many annual inspections did the customer sign up for?  --> fills "Cycles planned" (almost always 2)'; style = 'body' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'Decision tree — use this for every row'; style = 'h2' }
        @{ text = 'Has the install happened yet?'; style = 'body' }
        @{ text = '   NO  -->  install pending'; style = 'mono' }
        @{ text = '              Last service date  = blank (fill once install happens)'; style = 'mono' }
        @{ text = '              Cycle index        = 0'; style = 'mono' }
        @{ text = '              Install done?      = N'; style = 'mono' }
        @{ text = ''; style = 'spacer' }
        @{ text = '   YES -->  install is done'; style = 'mono' }
        @{ text = '              Install done?      = Y'; style = 'mono' }
        @{ text = '              Last service date  = the date of the most recent visit (see below)'; style = 'mono' }
        @{ text = ''; style = 'spacer' }
        @{ text = '              Then: have any annual inspections happened since the install?'; style = 'mono' }
        @{ text = '                 No annuals yet                  -->  Cycle index = 0  (Last service date = install date)'; style = 'mono' }
        @{ text = '                 Year 1 done                     -->  Cycle index = 1  (Last service date = Y1 date)'; style = 'mono' }
        @{ text = '                 Year 1 + Year 2 done            -->  Cycle index = 2  (Last service date = Y2 date)'; style = 'mono' }
        @{ text = '                 Year 1 + Y2 + Y3 done           -->  Cycle index = 3  (etc.)'; style = 'mono' }
        @{ text = ''; style = 'spacer' }
        @{ text = 'Cycles planned  =  total annual inspections in the customer''s contract'; style = 'body' }
        @{ text = '   2 year contract (standard, default)  -->  2'; style = 'mono' }
        @{ text = '   1 year contract                      -->  1'; style = 'mono' }
        @{ text = '   3 year contract                      -->  3'; style = 'mono' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'Worked examples'; style = 'h2' }
        @{ text = 'Example 1 — Brand new customer, install scheduled but not done yet'; style = 'body' }
        @{ text = '   Last service date = (blank)     Cycle index = 0     Cycles planned = 2     Install done? = N     Annuals remaining = 2'; style = 'mono' }
        @{ text = ''; style = 'spacer' }
        @{ text = 'Example 2 — Install done in March 2026, no annuals yet'; style = 'body' }
        @{ text = '   Last service date = 2026-03-15   Cycle index = 0     Cycles planned = 2     Install done? = Y     Annuals remaining = 2'; style = 'mono' }
        @{ text = ''; style = 'spacer' }
        @{ text = 'Example 3 — Install done in 2024, Year 1 inspection done in April 2025'; style = 'body' }
        @{ text = '   Last service date = 2025-04-10   Cycle index = 1     Cycles planned = 2     Install done? = Y     Annuals remaining = 1'; style = 'mono' }
        @{ text = ''; style = 'spacer' }
        @{ text = 'Example 4 — Install + both annual inspections done; agreement complete'; style = 'body' }
        @{ text = '   Last service date = 2026-02-01   Cycle index = 2     Cycles planned = 2     Install done? = Y     Annuals remaining = 0'; style = 'mono' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'Required columns (marked * in the header)'; style = 'h2' }
        @{ text = 'Customer *           — full account name. If a customer has multiple properties, they share this name verbatim, character for character.'; style = 'body' }
        @{ text = 'Property *           — short label for the site. Defaults to the street address. Override only if the customer uses a name ("Personal home", "Vineyard", "Spec home").'; style = 'body' }
        @{ text = 'Address *            — street only ("1234 Main St"). No city/state/zip in this cell.'; style = 'body' }
        @{ text = 'City *               — city name only.'; style = 'body' }
        @{ text = 'Product *            — System or Spray. Use the dropdown.'; style = 'body' }
        @{ text = 'Sq ft *              — square footage being treated. Numeric, no commas needed.'; style = 'body' }
        @{ text = 'Last service date *  — most recent COMPLETED visit (install or last annual). Leave blank for install-pending rows.'; style = 'body' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'Optional columns'; style = 'h2' }
        @{ text = 'State              — two-letter code. Defaults to CA.'; style = 'body' }
        @{ text = 'ZIP                — 5- or 9-digit. Used to auto-infer Region if blank.'; style = 'body' }
        @{ text = 'Contract value     — USD. Leave blank for waived/unknown.'; style = 'body' }
        @{ text = 'Interval (months)  — maintenance cadence. Default 12.'; style = 'body' }
        @{ text = 'Customer email     — strongly recommended.'; style = 'body' }
        @{ text = 'Customer phone     — strongly recommended. Auto-formatted (XXX) XXX-XXXX.'; style = 'body' }
        @{ text = 'Region             — NORCAL / SOCAL / OTHER. Auto-inferred from CA ZIP if blank.'; style = 'body' }
        @{ text = 'Cycle index        — see decision tree above. Default 0.'; style = 'body' }
        @{ text = 'Cycles planned     — see decision tree above. Default 2.'; style = 'body' }
        @{ text = 'Office notes       — free-form internal notes. Source "Notes" + "Maintenance Details" merged here. Edit freely.'; style = 'body' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'Helper columns (not imported — for your use only)'; style = 'h2' }
        @{ text = 'Source row #       — the row number in the original "System Master List.xlsx". Use it to cross-check against the source spreadsheet while you''re verifying.'; style = 'body' }
        @{ text = 'Install done?      — Y/N copied from the source "Completed?" column. Quick filter for "what installs are still pending".'; style = 'body' }
        @{ text = 'Verified by        — your initials when you''ve checked the row.'; style = 'body' }
        @{ text = 'Verified date      — date you signed off.'; style = 'body' }
        @{ text = 'Annuals remaining  — auto-computed: Cycles planned minus Cycle index. Tells you at a glance how many more annual inspections the customer is owed.'; style = 'body' }
        @{ text = ''; style = 'spacer' }

        @{ text = 'When the list is fully verified'; style = 'h2' }
        @{ text = '1. Click the Data tab. File -> Save As -> CSV UTF-8 (Excel will warn it can only save one sheet — that''s fine, click OK).'; style = 'body' }
        @{ text = '2. Open CitroTechnician -> Settings -> Import.'; style = 'body' }
        @{ text = '3. Upload the CSV. The dry-run preview catches anything still off before any data is written.'; style = 'body' }
        @{ text = '4. Once the preview is green, click Import. Job records get created and we start using CitroTechnician for real.'; style = 'body' }
    )

    $r = 1
    foreach ($e in $insRows) {
        $cell = $insSheet.Cells.Item($r, 1)
        $cell.Value2 = $e.text
        switch ($e.style) {
            'title' { $cell.Font.Size = 18; $cell.Font.Bold = $true; $cell.Font.Color = $NAVY; $insSheet.Rows.Item($r).RowHeight = 30 }
            'h2'    { $cell.Font.Size = 13; $cell.Font.Bold = $true; $cell.Font.Color = $NAVY; $insSheet.Rows.Item($r).RowHeight = 24 }
            'meta'  { $cell.Font.Size = 10; $cell.Font.Italic = $true; $cell.Font.Color = $GRAY_HEADER }
            'body'  { $cell.Font.Size = 11; $cell.WrapText = $true; $insSheet.Rows.Item($r).RowHeight = 18 }
            'mono'  { $cell.Font.Size = 10; $cell.Font.Name = 'Consolas'; $cell.Font.Color = $GRAY_HEADER }
            'spacer'{ }
        }
        $r++
    }
    $insSheet.Columns.Item(1).ColumnWidth = 130
    $insSheet.Tab.Color = $NAVY_LIGHT

    # ----- Sheet: Data -----
    $dataSheet = $bk.Sheets.Add()
    $dataSheet.Name = 'Data'
    $dataSheet.Tab.Color = $NAVY
    $dataSheet.Activate() | Out-Null

    # Headers.
    for ($c = 0; $c -lt $cols.Count; $c++) {
        $col = $cols[$c]
        $colIdx = $c + 1
        $hcell = $dataSheet.Cells.Item(1, $colIdx)
        $label = $col.header
        if ($col.req) { $label = "$label *" }
        $hcell.Value2 = $label
        $hcell.Font.Bold = $true
        $hcell.Font.Color = $WHITE
        $hcell.Font.Size = 11
        if ($col.helper) {
            $hcell.Interior.Color = $GRAY_HEADER
        } else {
            $hcell.Interior.Color = $NAVY
        }
        $hcell.HorizontalAlignment = -4108  # xlCenter
        $hcell.VerticalAlignment   = -4108
        $hcell.WrapText = $true
        $dataSheet.Columns.Item($colIdx).ColumnWidth = $col.width
        $dataSheet.Columns.Item($colIdx).NumberFormat = $col.format

        # Hover-comment on the header for the team's quick reference.
        if ($headerComments.ContainsKey($col.field)) {
            try { $hcell.ClearComments() } catch { }
            $cmt = $hcell.AddComment($headerComments[$col.field])
            $cmt.Shape.TextFrame.AutoSize = $true
        }
    }
    $dataSheet.Rows.Item(1).RowHeight = 36
    $dataSheet.Application.ActiveWindow.SplitRow = 1
    $dataSheet.Application.ActiveWindow.FreezePanes = $true

    # Per-cell writes. PowerShell's COM bridge mangles 2D-array bulk
    # assignment to Range.Value2; per-cell is ~1-2s for ~1k cells, fine.
    $rowCount = $rows.Count
    if ($rowCount -gt 0) {
        for ($i = 0; $i -lt $rowCount; $i++) {
            $row = $rows[$i]
            $excelRow = $i + 2
            for ($c = 0; $c -lt $cols.Count; $c++) {
                $field = $cols[$c].field
                $prop  = $row.PSObject.Properties[$field]
                if (-not $prop) { continue }
                $val = $prop.Value
                if ($null -eq $val) { continue }
                Set-CellValue -Cell $dataSheet.Cells.Item($excelRow, $c + 1) -Value $val
            }
        }

        # Formula-driven helper columns (e.g. Annuals remaining).
        $cycleIdxLetter = $null
        $cyclesPlannedLetter = $null
        for ($k = 0; $k -lt $cols.Count; $k++) {
            $cl = ($dataSheet.Cells.Item(1, $k + 1).Address(0,0) -replace '\d','')
            if ($cols[$k].field -eq 'cycleIndex')    { $cycleIdxLetter = $cl }
            if ($cols[$k].field -eq 'cyclesPlanned') { $cyclesPlannedLetter = $cl }
        }
        for ($c = 0; $c -lt $cols.Count; $c++) {
            if (-not $cols[$c].formula) { continue }
            $colIdx = $c + 1
            for ($i = 0; $i -lt $rowCount; $i++) {
                $excelRow = $i + 2
                if ($cols[$c].field -eq 'annualsRemaining') {
                    $f = "=IF(ISBLANK(`$$cyclesPlannedLetter$excelRow),`"`",MAX(0,`$$cyclesPlannedLetter$excelRow-`$$cycleIdxLetter$excelRow))"
                    $dataSheet.Cells.Item($excelRow, $colIdx).Formula = $f
                }
            }
        }

        # Highlight cells the team must fill (yellow). Walk in column order
        # so we batch each column's gaps in one Range op.
        for ($c = 0; $c -lt $cols.Count; $c++) {
            $field = $cols[$c].field
            if ($field -ne 'product' -and $field -ne 'sqft' -and $field -ne 'lastServiceDate' -and $field -ne 'cycleIndex') { continue }
            $colIdx = $c + 1
            $colLetter = ($dataSheet.Cells.Item(1, $colIdx).Address(0,0) -replace '\d','')
            for ($i = 0; $i -lt $rowCount; $i++) {
                $needs = $false
                $val = $rows[$i].PSObject.Properties[$field].Value
                switch ($field) {
                    'product'         { if (-not $val) { $needs = $true } }
                    'sqft'            { if (-not $val) { $needs = $true } }
                    'lastServiceDate' { if (-not $val) { $needs = $true } }
                    'cycleIndex'      {
                        # cycleIndex 0 is fine when install hasn't happened.
                        # When install IS done (Y), we still default to 0 because
                        # cycleIndex 0 = "this row is the install" — leave it
                        # unless the team knows the property is mid-cycle.
                        # No yellow needed by default.
                    }
                }
                if ($needs) {
                    $dataSheet.Range("$colLetter$($i + 2)").Interior.Color = $YELLOW
                }
            }
        }

        # Borders on the data block.
        $allRng = $dataSheet.Range($dataSheet.Cells.Item(1,1), $dataSheet.Cells.Item(1 + $rowCount, $cols.Count))
        $allRng.Borders.Item(8).LineStyle  = 1  # xlEdgeTop
        $allRng.Borders.Item(9).LineStyle  = 1
        $allRng.Borders.Item(10).LineStyle = 1
        $allRng.Borders.Item(7).LineStyle  = 1
        $allRng.Borders.Item(12).LineStyle = 1  # xlInsideHorizontal
        $allRng.Borders.Item(11).LineStyle = 1  # xlInsideVertical
        $allRng.Borders.Color = $GRAY_BORDER

        # Vertical alignment top + wrap on Office notes.
        $allRng.VerticalAlignment = -4160  # xlTop
        $notesIdx = -1
        for ($k = 0; $k -lt $cols.Count; $k++) { if ($cols[$k].field -eq 'officeNotes') { $notesIdx = $k; break } }
        if ($notesIdx -ge 0) {
            $dataSheet.Columns.Item($notesIdx + 1).WrapText = $true
        }
    }

    # Data validation dropdowns — applied to the column for ~500 rows so
    # the team can paste-extend without losing dropdowns.
    $vEnd = [Math]::Max($rowCount + 1, 500)
    foreach ($spec in @(
        @{ field='product';       formula='=Lookups!$A$2:$A$3' }
        @{ field='region';        formula='=Lookups!$B$2:$B$4' }
        @{ field='state';         formula='=Lookups!$C$2:$C$9' }
        @{ field='cycleIndex';    formula='=Lookups!$D$2:$D$7' }
        @{ field='cyclesPlanned'; formula='=Lookups!$E$2:$E$6' }
    )) {
        $idx = -1
        for ($k = 0; $k -lt $cols.Count; $k++) { if ($cols[$k].field -eq $spec.field) { $idx = $k; break } }
        if ($idx -lt 0) { continue }
        $colIdx = $idx + 1
        $colLetter = ($dataSheet.Cells.Item(1, $colIdx).Address(0,0) -replace '\d','')
        $vRng = $dataSheet.Range("$colLetter`2:$colLetter$vEnd")
        $vRng.Validation.Delete()
        $vRng.Validation.Add(3, 1, 1, $spec.formula) | Out-Null  # xlValidateList, xlValidAlertStop, xlBetween
        $vRng.Validation.IgnoreBlank   = $true
        $vRng.Validation.InCellDropdown = $true
    }

    # AutoFilter on the header row.
    $dataSheet.Range($dataSheet.Cells.Item(1,1), $dataSheet.Cells.Item([Math]::Max($rowCount+1, 2), $cols.Count)).AutoFilter() | Out-Null

    # Drop the default Sheet1 stub now that our three sheets exist.
    $defaultSheet.Delete()

    # Make Data the active sheet on open.
    $dataSheet.Activate() | Out-Null
    $dataSheet.Cells.Item(2,1).Select() | Out-Null

    # ----- Save (xlsx = file format 51) -----
    $bk.SaveAs($OutputPath, 51)
    $bk.Close($false)
} finally {
    $xl.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

# ---------- Report --------------------------------------------------------

$missingProduct = ($rows | Where-Object { -not $_.product }).Count
$missingSqft    = ($rows | Where-Object { -not $_.sqft }).Count
$missingDate    = ($rows | Where-Object { -not $_.lastServiceDate }).Count
$missingCity    = ($rows | Where-Object { -not $_.city }).Count
$missingState   = ($rows | Where-Object { -not $_.state -or $_.state -eq 'CA' }).Count
$installDone    = ($rows | Where-Object { $_.installDone -eq 'Y' }).Count
$installPending = $rows.Count - $installDone

Write-Host ""
Write-Host "  [OK] Wrote $($rows.Count) rows to $OutputPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Source coverage:" -ForegroundColor Cyan
Write-Host "    Total parsed              : $($rows.Count)"
Write-Host "    Skipped (blank/TBD)       : $skipped"
Write-Host "    Install completed (Y)     : $installDone"
Write-Host "    Install pending (N)       : $installPending"
Write-Host ""
Write-Host "  Cells highlighted yellow (team must fill):" -ForegroundColor Yellow
Write-Host "    Product                   : $missingProduct"
Write-Host "    Sq ft                     : $missingSqft"
Write-Host "    Last service date         : $missingDate (mostly install-pending)"
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Cyan
Write-Host "    1. Open $OutputPath"
Write-Host "    2. Read the Instructions tab once, then verify rows on the Data tab"
Write-Host "    3. Save Data as CSV (UTF-8) when finished"
Write-Host "    4. Upload at /settings/import"
