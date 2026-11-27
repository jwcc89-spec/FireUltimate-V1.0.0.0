import { type CSSProperties, useEffect, useRef } from "react";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Quote, Redo2, Underline, Undo2 } from "lucide-react";

/** Section headings become "201.1", "201.2"... through a CSS counter seeded with the policy number. */
function numberStyle(policyNumber: string): CSSProperties {
  return { "--policy-number": JSON.stringify(policyNumber ? `${policyNumber}.` : "") } as CSSProperties;
}

export function PolicyContentView({ content, policyNumber }: { content: JSONContent | null; policyNumber: string }) {
  const editor = useEditor({ extensions: [StarterKit], content: content ?? "", editable: false }, []);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(content ?? "");
  }, [editor, content]);
  return (
    <div className="policy-content" style={numberStyle(policyNumber)}>
      <EditorContent editor={editor} />
    </div>
  );
}

interface PolicyEditorProps {
  initial: JSONContent | null;
  policyNumber: string;
  onChange: (content: JSONContent) => void;
}

/** Mount with a key per policy: the starting content is read once. */
export function PolicyEditor({ initial, policyNumber, onChange }: PolicyEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: initial ?? "",
      shouldRerenderOnTransaction: true,
      onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON()),
    },
    [],
  );
  if (!editor) return null;
  const tools = [
    { label: "Bold", Icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", Icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Underline", Icon: Underline, active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
    {
      label: "Section (numbered)",
      Icon: Heading2,
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Subheading",
      Icon: Heading3,
      active: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    { label: "Bulleted list", Icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", Icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Quote", Icon: Quote, active: editor.isActive("blockquote"), run: () => editor.chain().focus().toggleBlockquote().run() },
  ];
  return (
    <div className="policy-editor">
      <div className="policy-editor-toolbar" role="toolbar" aria-label="Formatting">
        {tools.map(({ label, Icon, active, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`secondary-button compact-button ${active ? "department-toggle-active" : ""}`}
            onClick={run}
          >
            <Icon size={15} aria-hidden="true" />
          </button>
        ))}
        <span className="policy-editor-toolbar-gap" />
        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          className="secondary-button compact-button"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Redo"
          aria-label="Redo"
          className="secondary-button compact-button"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="policy-content policy-editor-body" style={numberStyle(policyNumber)}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
