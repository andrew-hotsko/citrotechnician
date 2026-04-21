"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addTemplateItem,
  deleteTemplateItem,
  moveTemplateItem,
  updateTemplateItem,
  updateTemplateName,
} from "@/app/actions/templates";
import { ProductBadge } from "@/components/badges";
import type { Product } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type TemplateItem = {
  id: string;
  label: string;
  order: number;
};

type Template = {
  id: string;
  product: Product;
  name: string;
  items: TemplateItem[];
};

export function TemplatesClient({ templates }: { templates: Template[] }) {
  return (
    <div className="mt-6 space-y-4">
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} />
      ))}
      {templates.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white/60 px-6 py-10 text-center">
          <p className="text-[13px] text-neutral-600">
            No templates seeded yet. Run{" "}
            <code className="text-[12px] font-mono text-neutral-800">
              npm run db:seed
            </code>{" "}
            to load the MFB-31 / MFB-34 / MFB-35-FM defaults.
          </p>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const [items, setItems] = useState<TemplateItem[]>(template.items);
  const [name, setName] = useState(template.name);
  const [editingName, setEditingName] = useState(false);
  const [, start] = useTransition();

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === template.name) {
      setEditingName(false);
      setName(template.name);
      return;
    }
    start(async () => {
      try {
        await updateTemplateName(template.id, trimmed);
        setEditingName(false);
        toast.success("Template name updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
        setName(template.name);
        setEditingName(false);
      }
    });
  }

  function add(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    // optimistic
    const tempId = `temp-${Date.now()}`;
    const nextOrder =
      items.length === 0 ? 0 : Math.max(...items.map((i) => i.order)) + 1;
    setItems((prev) => [...prev, { id: tempId, label: trimmed, order: nextOrder }]);
    start(async () => {
      try {
        const result = await addTemplateItem(template.id, trimmed);
        if (result.ok) {
          setItems((prev) =>
            prev.map((i) => (i.id === tempId ? { ...i, id: result.id } : i)),
          );
          toast.success("Item added");
        }
      } catch (err) {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function remove(id: string) {
    const prev = items;
    setItems((items) => items.filter((i) => i.id !== id));
    start(async () => {
      try {
        await deleteTemplateItem(id);
        toast.success("Item removed");
      } catch (err) {
        setItems(prev);
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function updateLabel(id: string, label: string) {
    const prev = items;
    setItems((items) =>
      items.map((i) => (i.id === id ? { ...i, label } : i)),
    );
    start(async () => {
      try {
        await updateTemplateItem(id, label);
      } catch (err) {
        setItems(prev);
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function move(id: string, direction: "up" | "down") {
    const prev = items;
    const index = items.findIndex((i) => i.id === id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= items.length) return;
    const next = [...items];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setItems(next);
    start(async () => {
      try {
        await moveTemplateItem(id, direction);
      } catch (err) {
        setItems(prev);
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ProductBadge product={template.product} />
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(template.name);
                  setEditingName(false);
                }
              }}
              className="text-[13px] font-semibold tracking-tight h-7 px-2 rounded-md border border-neutral-200 bg-white flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="group inline-flex items-center gap-1 text-[13px] font-semibold tracking-tight hover:text-neutral-600 truncate"
            >
              <span className="truncate">{name}</span>
              <Pencil className="h-3 w-3 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
            </button>
          )}
        </div>
        <span className="text-[11px] text-neutral-500 tabular-nums shrink-0">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </header>

      <ul className="divide-y divide-neutral-100">
        {items.map((item, i) => (
          <ItemRow
            key={item.id}
            item={item}
            isFirst={i === 0}
            isLast={i === items.length - 1}
            onRemove={() => remove(item.id)}
            onUpdate={(label) => updateLabel(item.id, label)}
            onMove={(dir) => move(item.id, dir)}
          />
        ))}
        {items.length === 0 && (
          <li className="px-4 py-6 text-center text-[12px] text-neutral-500">
            No items yet. Add the first one below.
          </li>
        )}
      </ul>

      <AddItemRow onAdd={add} />
    </section>
  );
}

function ItemRow({
  item,
  isFirst,
  isLast,
  onRemove,
  onUpdate,
  onMove,
}: {
  item: TemplateItem;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onUpdate: (label: string) => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const [pending, start] = useTransition();

  function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === item.label) {
      setEditing(false);
      setDraft(item.label);
      return;
    }
    start(() => onUpdate(trimmed));
    setEditing(false);
  }

  return (
    <li className="group flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-neutral-50/60">
      <span className="text-[11px] text-neutral-400 tabular-nums w-6 shrink-0">
        {item.order + 1}.
      </span>

      {editing ? (
        <div className="flex-1 flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(item.label);
                setEditing(false);
              }
            }}
            className="flex-1 h-7 px-2 text-[13px] rounded-md border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400"
          />
          <button
            type="button"
            onClick={save}
            className="h-7 w-7 grid place-items-center rounded-md bg-neutral-900 text-white hover:bg-neutral-800"
            aria-label="Save"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(item.label);
              setEditing(false);
            }}
            className="h-7 w-7 grid place-items-center rounded-md border border-neutral-200 bg-white hover:border-neutral-300"
            aria-label="Cancel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-[13px] text-neutral-700 truncate"
          >
            {item.label}
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconButton
              label="Move up"
              disabled={isFirst || pending}
              onClick={() => onMove("up")}
            >
              <ArrowUp className="h-3 w-3" />
            </IconButton>
            <IconButton
              label="Move down"
              disabled={isLast || pending}
              onClick={() => onMove("down")}
            >
              <ArrowDown className="h-3 w-3" />
            </IconButton>
            <IconButton label="Edit" onClick={() => setEditing(true)}>
              <Pencil className="h-3 w-3" />
            </IconButton>
            <IconButton label="Remove" onClick={onRemove} destructive>
              <Trash2 className="h-3 w-3" />
            </IconButton>
          </div>
        </>
      )}
    </li>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "h-6 w-6 grid place-items-center rounded-md transition-colors",
        disabled
          ? "text-neutral-300 cursor-not-allowed"
          : destructive
            ? "text-neutral-500 hover:bg-red-50 hover:text-red-600"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}

function AddItemRow({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    start(() => onAdd(trimmed));
    setValue("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-2 px-4 py-3 bg-neutral-50/60 border-t border-neutral-100"
    >
      <Plus className="h-3 w-3 text-neutral-400 shrink-0" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a checklist item and press Enter…"
        className="flex-1 h-7 px-2 text-[13px] bg-transparent focus:outline-none placeholder:text-neutral-400"
      />
      {value.trim() && (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-neutral-900 text-white text-[11px] font-medium hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              Add <kbd className="text-[10px] opacity-70">↵</kbd>
            </>
          )}
        </button>
      )}
    </form>
  );
}
