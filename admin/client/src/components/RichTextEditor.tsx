import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Button, Input, Popover, Tooltip } from "antd";
import {
  BoldOutlined,
  ClearOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import "./RichTextEditor.css";

type Props = {
  value?: string | null;
  onChange?: (html: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  maxChars?: number;
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function toEditorHtml(value: string | null | undefined) {
  if (!value) return "";
  if (/<(p|h[1-6]|ul|ol|blockquote|br|strong|em|u|s|a)\b/i.test(value)) return value;
  return value
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function ToolButton({ title, active, disabled, onClick, children }: { title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip title={title} mouseEnterDelay={0.4}>
      <Button
        size="small"
        type={active ? "primary" : "text"}
        ghost={false}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        aria-label={title}
        aria-pressed={active}
        style={{ minWidth: 28 }}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

function LinkButton({ editor, active, disabled }: { editor: Editor; active: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");

  function apply() {
    const value = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!value) chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:|tel:|\/)/i.test(value) ? value : `https://${value}` }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setHref(editor.getAttributes("link").href ?? "");
      }}
      trigger="click"
      content={
        <div style={{ display: "flex", gap: 8 }}>
          <Input autoFocus value={href} onChange={(e) => setHref(e.target.value)} onPressEnter={apply} placeholder="med-expo.org/events/…" style={{ width: 260 }} />
          <Button type="primary" onClick={apply}>
            {href.trim() ? "Сохранить" : "Убрать"}
          </Button>
        </div>
      }
    >
      <span>
        <ToolButton title="Ссылка" active={active} disabled={disabled} onClick={() => undefined}>
          <LinkOutlined />
        </ToolButton>
      </span>
    </Popover>
  );
}

function syncContent(editor: Editor, value: string | null | undefined) {
  const next = toEditorHtml(value);
  const current = editor.isEmpty ? "" : editor.getHTML();
  if (next !== current) editor.commands.setContent(next, { emitUpdate: false });
}

export function RichTextEditor({ value, onChange, placeholder, disabled, maxChars }: Props) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: toEditorHtml(valueRef.current),
    editable: !disabled,
    onCreate: ({ editor: e }) => syncContent(e, valueRef.current),
    onUpdate: ({ editor: e }) => onChange?.(e.isEmpty ? null : e.getHTML()),
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) syncContent(editor, value);
  }, [value, editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable === !!disabled) editor.setEditable(!disabled, false);
  }, [disabled, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
            chars: e.getText().length,
          }
        : null,
  });

  if (!editor || !state) return null;
  const c = () => editor.chain().focus();

  return (
    <div className={`rte${disabled ? " rte-disabled" : ""}`}>
      {!disabled && (
        <div className="rte-toolbar" role="toolbar" aria-label="Форматирование текста">
          <ToolButton title="Заголовок" active={state.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
            <b>H2</b>
          </ToolButton>
          <ToolButton title="Подзаголовок" active={state.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
            <b>H3</b>
          </ToolButton>
          <span className="rte-sep" />
          <ToolButton title="Жирный (Ctrl+B)" active={state.bold} onClick={() => c().toggleBold().run()}>
            <BoldOutlined />
          </ToolButton>
          <ToolButton title="Курсив (Ctrl+I)" active={state.italic} onClick={() => c().toggleItalic().run()}>
            <ItalicOutlined />
          </ToolButton>
          <ToolButton title="Подчёркнутый (Ctrl+U)" active={state.underline} onClick={() => c().toggleUnderline().run()}>
            <UnderlineOutlined />
          </ToolButton>
          <ToolButton title="Зачёркнутый" active={state.strike} onClick={() => c().toggleStrike().run()}>
            <StrikethroughOutlined />
          </ToolButton>
          <LinkButton editor={editor} active={state.link} />
          <span className="rte-sep" />
          <ToolButton title="Маркированный список" active={state.bullet} onClick={() => c().toggleBulletList().run()}>
            <UnorderedListOutlined />
          </ToolButton>
          <ToolButton title="Нумерованный список" active={state.ordered} onClick={() => c().toggleOrderedList().run()}>
            <OrderedListOutlined />
          </ToolButton>
          <ToolButton title="Цитата" active={state.quote} onClick={() => c().toggleBlockquote().run()}>
            <b>“”</b>
          </ToolButton>
          <ToolButton title="Разделитель" onClick={() => c().setHorizontalRule().run()}>
            <b>—</b>
          </ToolButton>
          <span className="rte-sep" />
          <ToolButton title="Убрать форматирование" onClick={() => c().unsetAllMarks().clearNodes().run()}>
            <ClearOutlined />
          </ToolButton>
          <ToolButton title="Отменить (Ctrl+Z)" disabled={!state.canUndo} onClick={() => c().undo().run()}>
            <UndoOutlined />
          </ToolButton>
          <ToolButton title="Повторить (Ctrl+Shift+Z)" disabled={!state.canRedo} onClick={() => c().redo().run()}>
            <RedoOutlined />
          </ToolButton>
        </div>
      )}
      <div className="rte-content">
        <EditorContent editor={editor} />
      </div>
      <div className="rte-footer" style={maxChars && state.chars > maxChars ? { color: "#d4380d" } : undefined}>
        {state.chars}
        {maxChars ? ` / ${maxChars}` : ""} знаков
      </div>
    </div>
  );
}
