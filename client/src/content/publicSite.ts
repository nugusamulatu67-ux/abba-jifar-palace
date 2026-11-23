/**
 * Public copy for the palace website.
 * Statements marked verified come from the project documents or the development seed.
 * Anything else is a placeholder and must not be read as historical fact.
 */

export interface VerifiedFact {
  label: string
  value: string
  source: string
}

export interface PlaceholderSection {
  id: string
  title: string
  purpose: string
}

export interface TourTheme {
  name: string
  description: string
}

export interface GallerySlot {
  id: string
  src: string | null
  alt: string
  caption: string
}

export interface SampleAnnouncement {
  id: string
  title: string
  body: string
  dateLabel: string
}

export const verifiedFacts: VerifiedFact[] = [
  {
    label: 'Place',
    value: 'Abba Jifar Palace',
    source: 'Project overview',
  },
  {
    label: 'Setting',
    value: 'A historical heritage site in Jimma, Ethiopia',
    source: 'Project overview',
  },
  {
    label: 'Purpose of this website',
    value: 'Introduce the palace and, in a later phase, let visitors book a tour.',
    source: 'Project overview',
  },
]

export const aboutPlaceholders: PlaceholderSection[] = [
  {
    id: 'abba-jifar-ii',
    title: 'Historical background of Abba Jifar II',
    purpose: 'A verified biography has not been added to the project documents.',
  },
  {
    id: 'jimma-kingdom',
    title: 'The Jimma Kingdom',
    purpose: 'A verified introduction to the kingdom has not been added to the project documents.',
  },
  {
    id: 'significance',
    title: 'Historical and cultural significance',
    purpose: 'The documents call the palace a heritage site. They do not yet describe its significance in detail.',
  },
  {
    id: 'architecture',
    title: 'Architecture and heritage',
    purpose: 'Architectural description, dates, and conservation notes are not in the project documents.',
  },
]

/** Tour names and descriptions already stored by the development seed. Not a public price list. */
export const tourThemes: TourTheme[] = [
  {
    name: 'Palace History Tour',
    description: 'A guided walk through the halls and history of Abba Jifar Palace.',
  },
  {
    name: 'Museum and Garden Walk',
    description: 'The palace museum collections and the garden, at a slower pace.',
  },
  {
    name: 'Full Heritage Visit',
    description: 'The history tour plus time in the museum and garden.',
  },
]

/**
 * Photograph slots. src stays null until an authentic palace photograph is added.
 * Do not point these at unrelated buildings.
 */
export const gallerySlots: GallerySlot[] = [
  {
    id: 'approach',
    src: null,
    alt: 'Empty frame. A palace photograph has not been added yet.',
    caption: 'Approach to the palace. Photograph not yet added.',
  },
  {
    id: 'grounds',
    src: null,
    alt: 'Empty frame. A grounds photograph has not been added yet.',
    caption: 'Palace grounds. Photograph not yet added.',
  },
  {
    id: 'interior',
    src: null,
    alt: 'Empty frame. An interior photograph has not been added yet.',
    caption: 'Interior. Photograph not yet added.',
  },
  {
    id: 'detail',
    src: null,
    alt: 'Empty frame. A heritage-detail photograph has not been added yet.',
    caption: 'Heritage detail. Photograph not yet added.',
  },
]

export const visitKnown = [
  'The palace is in Jimma, Ethiopia. A street address is not in the project documents.',
  'Visits are expected to use the tour themes already stored for development. Booking is not open in this phase.',
  'Tourists can create an account and sign in. Staff accounts are created by an administrator.',
]

export const visitUnverified = [
  'Opening hours',
  'A street address or map pin',
  'Telephone number',
  'Email address',
  'Public ticket prices',
  'Visitor rules set by the palace',
]

export const sampleAnnouncements: SampleAnnouncement[] = [
  {
    id: 'sample-not-live',
    title: 'This list is sample data',
    body: 'The database has an announcements table, and the public page does not read it yet. These cards are temporary development samples. They are not notices published by the palace.',
    dateLabel: 'Development sample',
  },
  {
    id: 'sample-accounts',
    title: 'Sample: tourist accounts can be created',
    body: 'Registration on this website creates a tourist account. Guide, receptionist, and administrator accounts are not available from the public form.',
    dateLabel: 'Development sample',
  },
  {
    id: 'sample-tours',
    title: 'Sample: tour booking is not open',
    body: 'The tour themes can be read on the Tours page. Choosing a date, paying, and checking in are later phases.',
    dateLabel: 'Development sample',
  },
]
