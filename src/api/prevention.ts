/** Fire Prevention API client: properties and contacts. Lists match server/modules/preventionDefaults.mjs. */
import { apiJson, send } from "./maintenance";

export const PROPERTY_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
] as const;

export const OCCUPANCY_TYPES = [
  "Assembly",
  "Educational",
  "Day Care",
  "Health Care",
  "Ambulatory Health Care",
  "Detention and Correctional",
  "One- and Two-Family Dwelling",
  "Lodging or Rooming House",
  "Hotel or Dormitory",
  "Apartment Building",
  "Residential Board and Care",
  "Mercantile",
  "Business",
  "Industrial",
  "Storage",
  "Mixed Use",
  "Vacant",
  "Other",
] as const;

export const CONTACT_ROLES = ["Owner", "Tenant", "Building Maintenance", "Manager", "Secondary Contact", "Other"] as const;

export interface PropertySummary {
  id: string;
  name: string;
  address: string;
  unit: string;
  city: string;
  state: string;
  postalCode: string;
  propertyType: string;
  occupancyType: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  latitude: number | null;
  longitude: number | null;
  ownerName: string;
  contactCount: number;
  updatedAt: string;
}

export interface PropertyContact {
  id: string;
  propertyId: string;
  firstName: string;
  lastName: string;
  businessName: string;
  role: string;
  isPrimary: boolean;
  phone: string;
  email: string;
  addressStreet: string;
  addressUnit: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  notes: string;
}

export interface PropertyDetail extends PropertySummary {
  streetViewPanoId: string;
  streetViewHeading: number | null;
  streetViewPitch: number | null;
  streetViewZoom: number | null;
  photo: string;
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedBy: string;
  contacts: PropertyContact[];
}

export interface PropertyInput {
  name: string;
  address: string;
  unit: string;
  city: string;
  state: string;
  postalCode: string;
  propertyType: string;
  occupancyType: string;
  squareFeet: string;
  yearBuilt: string;
  latitude: number | null;
  longitude: number | null;
  streetViewPanoId: string;
  streetViewHeading: number | null;
  streetViewPitch: number | null;
  streetViewZoom: number | null;
  photo: string;
  notes: string;
}

export type ContactInput = Omit<PropertyContact, "id" | "propertyId">;

const propertyUrl = (id: string) => `/api/prevention/properties/${encodeURIComponent(id)}`;

export const getProperties = () => apiJson<PropertySummary[]>("/api/prevention/properties");
export const getProperty = (id: string) => apiJson<PropertyDetail>(propertyUrl(id));
export const createProperty = (input: PropertyInput) =>
  apiJson<PropertyDetail>("/api/prevention/properties", send("POST", input));
export const updateProperty = (id: string, input: Partial<PropertyInput>) =>
  apiJson<PropertyDetail>(propertyUrl(id), send("PATCH", input));
export const deleteProperty = (id: string) => apiJson<void>(propertyUrl(id), send("DELETE"));

export const createContact = (propertyId: string, input: ContactInput) =>
  apiJson<PropertyDetail>(`${propertyUrl(propertyId)}/contacts`, send("POST", input));
export const updateContact = (id: string, input: Partial<ContactInput>) =>
  apiJson<PropertyDetail>(`/api/prevention/contacts/${encodeURIComponent(id)}`, send("PATCH", input));
export const deleteContact = (id: string) =>
  apiJson<PropertyDetail>(`/api/prevention/contacts/${encodeURIComponent(id)}`, send("DELETE"));

export function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPES.find((entry) => entry.value === value)?.label ?? value;
}

export function contactDisplayName(contact: Pick<PropertyContact, "firstName" | "lastName" | "businessName">): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.businessName;
}

export function fullAddress(property: Pick<PropertySummary, "address" | "unit" | "city" | "state" | "postalCode">): string {
  const street = [property.address, property.unit].filter(Boolean).join(" ");
  const cityLine = [property.city, [property.state, property.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street, cityLine].filter(Boolean).join(", ");
}
