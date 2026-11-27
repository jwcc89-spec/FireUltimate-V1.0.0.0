import { useState } from "react";
import { Pencil, Plus, UserRound } from "lucide-react";
import {
  CONTACT_ROLES,
  contactDisplayName,
  createContact,
  deleteContact,
  updateContact,
  type ContactInput,
  type PropertyContact,
  type PropertyDetail,
} from "../../api/prevention";
import { NerisFlatSingleOptionSelect } from "../../NerisFlatSelects";
import { toOptions } from "../maintenance/maintenanceUtils";
import { EditDialog } from "../maintenance/MaintenanceSetupTabs";
import { useDialogSave } from "../maintenance/useDialogSave";

const EMPTY_CONTACT: ContactInput = {
  firstName: "",
  lastName: "",
  businessName: "",
  role: "",
  isPrimary: false,
  phone: "",
  email: "",
  addressStreet: "",
  addressUnit: "",
  addressCity: "",
  addressState: "",
  addressZip: "",
  notes: "",
};

type ContactDraft = ContactInput & { id: string | null };

/** ESO-style contact list: name, role (or "No Roles") and a PRIMARY badge. */
export function PropertyContactsTab({
  property,
  canManage,
  onChanged,
}: {
  property: PropertyDetail;
  canManage: boolean;
  onChanged: (next: PropertyDetail) => void;
}) {
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { saving, error, setError, run } = useDialogSave();

  const open = (contact: PropertyContact | null) => {
    setError("");
    setConfirmDelete(false);
    if (!contact) {
      setDraft({ ...EMPTY_CONTACT, id: null, isPrimary: property.contacts.length === 0 });
      return;
    }
    setDraft({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      businessName: contact.businessName,
      role: contact.role,
      isPrimary: contact.isPrimary,
      phone: contact.phone,
      email: contact.email,
      addressStreet: contact.addressStreet,
      addressUnit: contact.addressUnit,
      addressCity: contact.addressCity,
      addressState: contact.addressState,
      addressZip: contact.addressZip,
      notes: contact.notes,
    });
  };

  const save = () => {
    if (!draft) return;
    const { id, ...input } = draft;
    void run(async () => {
      const next = id ? await updateContact(id, input) : await createContact(property.id, input);
      setDraft(null);
      onChanged(next);
    }, "Could not save the contact.");
  };

  const remove = () => {
    if (!draft?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const id = draft.id;
    void run(async () => {
      const next = await deleteContact(id);
      setDraft(null);
      onChanged(next);
    }, "Could not delete the contact.");
  };

  const field = (key: Exclude<keyof ContactInput, "isPrimary" | "role">, label: string, wide = false) =>
    draft ? (
      <label className={wide ? "property-form-wide" : undefined}>
        {label}
        {key === "notes" ? (
          <textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        ) : (
          <input type="text" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
        )}
      </label>
    ) : null;

  return (
    <div className="property-contacts">
      {canManage ? (
        <div className="header-actions">
          <button type="button" className="primary-button compact-button maintenance-icon-button" onClick={() => open(null)}>
            <Plus size={14} aria-hidden="true" /> Add Contact
          </button>
        </div>
      ) : null}
      {property.contacts.length === 0 ? (
        <p className="field-hint">No contacts yet.</p>
      ) : (
        <ul className="property-contact-list">
          {property.contacts.map((contact) => (
            <li key={contact.id} className="property-contact-card">
              <span className="property-contact-avatar" aria-hidden="true">
                <UserRound size={18} />
              </span>
              <span className="property-contact-text">
                <strong>{contactDisplayName(contact)}</strong>
                <span>
                  {contact.role || "No Roles"}
                  {contact.businessName && (contact.firstName || contact.lastName) ? ` · ${contact.businessName}` : ""}
                </span>
                {contact.phone || contact.email ? (
                  <span className="field-hint">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</span>
                ) : null}
              </span>
              {contact.isPrimary ? <span className="property-primary-badge">PRIMARY</span> : null}
              <button
                type="button"
                className="secondary-button compact-button"
                aria-label={canManage ? `Edit ${contactDisplayName(contact)}` : `View ${contactDisplayName(contact)}`}
                onClick={() => open(contact)}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <EditDialog
          title={draft.id ? (canManage ? "Edit Contact" : "Contact") : "Add Contact"}
          error={confirmDelete ? error || "Click Delete again to remove this contact." : error}
          saving={saving}
          readOnly={!canManage}
          onSave={save}
          onCancel={() => setDraft(null)}
          onDelete={draft.id ? remove : undefined}
        >
          {field("firstName", "First Name")}
          {field("lastName", "Last Name")}
          {field("businessName", "Business Name")}
          <label>
            Role
            <NerisFlatSingleOptionSelect
              inputId="property-contact-role"
              value={draft.role}
              options={toOptions(CONTACT_ROLES)}
              usePortal
              allowClear
              disabled={!canManage}
              placeholder="No role"
              onChange={(value) => setDraft({ ...draft, role: value })}
            />
          </label>
          {field("phone", "Phone")}
          {field("email", "Email")}
          <label className="property-checkbox">
            <input
              type="checkbox"
              checked={draft.isPrimary}
              onChange={(event) => setDraft({ ...draft, isPrimary: event.target.checked })}
            />
            Primary contact
          </label>
          <p className="field-hint property-form-wide">Mailing address (leave blank if it is the property address)</p>
          {field("addressStreet", "Street", true)}
          {field("addressUnit", "Apt / Suite")}
          {field("addressCity", "City")}
          {field("addressState", "State")}
          {field("addressZip", "Zip")}
          {field("notes", "Notes", true)}
        </EditDialog>
      ) : null}
    </div>
  );
}
