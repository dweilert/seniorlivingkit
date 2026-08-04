export const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Needs Assessment",
  "Touring",
  "Application",
  "Placed",
  "Closed"
];

export const SAMPLE_LEADS = [
  {
    id: "lead-001",
    name: "Margaret Ellis",
    relationship: "Daughter: Renee Ellis",
    phone: "(512) 555-0198",
    email: "renee.ellis@example.com",
    status: "Needs Assessment",
    urgency: "30 days",
    budget: "$4,500-$6,000",
    careNeeds: "Assisted living, medication management, mild memory support",
    preferredArea: "Austin / Westlake",
    assignedTo: "Kit",
    nextStep: "Confirm assessment notes and send three facility options",
    linkedFacilities: ["tx-hhsc-assisted-living:000745", "tx-hhsc-assisted-living:105071"]
  },
  {
    id: "lead-002",
    name: "Daniel Ortiz",
    relationship: "Self",
    phone: "(512) 555-0144",
    email: "daniel.ortiz@example.com",
    status: "Touring",
    urgency: "Immediate",
    budget: "$3,800-$5,200",
    careNeeds: "Assisted living, mobility support",
    preferredArea: "North Austin / Round Rock",
    assignedTo: "Kit",
    nextStep: "Follow up after Friday tour",
    linkedFacilities: ["tx-hhsc-assisted-living:107288"]
  },
  {
    id: "lead-003",
    name: "Patricia Nguyen",
    relationship: "Son: Anthony Nguyen",
    phone: "(737) 555-0182",
    email: "anthony.nguyen@example.com",
    status: "New",
    urgency: "60-90 days",
    budget: "Unknown",
    careNeeds: "Independent living or assisted living evaluation",
    preferredArea: "Cedar Park",
    assignedTo: "Unassigned",
    nextStep: "Initial discovery call",
    linkedFacilities: []
  },
  {
    id: "lead-004",
    name: "Robert Kim",
    relationship: "Niece: Julia Kim",
    phone: "(512) 555-0171",
    email: "julia.kim@example.com",
    status: "Application",
    urgency: "2 weeks",
    budget: "$6,000-$7,500",
    careNeeds: "Memory care, secure community",
    preferredArea: "Austin",
    assignedTo: "Kit",
    nextStep: "Check room availability and paperwork",
    linkedFacilities: ["tx-hhsc-assisted-living:106219"]
  }
];

export const SAMPLE_COMMUNICATIONS = [
  {
    id: "comm-001",
    leadId: "lead-001",
    facilityKey: "tx-hhsc-assisted-living:000745",
    direction: "Outbound",
    channel: "Email",
    date: "2026-08-01 9:15 AM",
    subject: "Sent Brookdale Westlake Hills overview",
    body: "Shared capacity, location, and next-step tour availability request."
  },
  {
    id: "comm-002",
    leadId: "lead-001",
    facilityKey: "",
    direction: "Inbound",
    channel: "Phone",
    date: "2026-08-01 2:40 PM",
    subject: "Renee confirmed care priorities",
    body: "Medication support and proximity to Westlake are highest priority."
  },
  {
    id: "comm-003",
    leadId: "lead-002",
    facilityKey: "tx-hhsc-assisted-living:107288",
    direction: "Outbound",
    channel: "Phone",
    date: "2026-07-31 11:05 AM",
    subject: "Tour confirmation",
    body: "Confirmed Friday tour window and requested current room availability."
  },
  {
    id: "comm-004",
    leadId: "lead-004",
    facilityKey: "tx-hhsc-assisted-living:106219",
    direction: "Inbound",
    channel: "Email",
    date: "2026-07-30 4:20 PM",
    subject: "Facility requested application packet",
    body: "Need physician form and medication list before final review."
  }
];

export const PERSON_TYPES = ["Resident", "Family", "Friend", "Doctor", "Advisor", "Facility contact"];

export const SAMPLE_PEOPLE = [
  {
    id: "person-margaret",
    name: "Margaret Ellis",
    type: "Resident",
    age: 83,
    phone: "(512) 555-0140",
    email: "margaret.ellis@example.com",
    city: "Austin",
    state: "TX",
    zip: "78746",
    latitude: 30.2834,
    longitude: -97.8005,
    notes: "Considering assisted living near Westlake. Mild memory support."
  },
  {
    id: "person-renee",
    name: "Renee Ellis",
    type: "Family",
    age: 55,
    phone: "(512) 555-0198",
    email: "renee.ellis@example.com",
    city: "Austin",
    state: "TX",
    zip: "78704",
    latitude: 30.2457,
    longitude: -97.756,
    notes: "Daughter and primary decision maker."
  },
  {
    id: "person-mark",
    name: "Mark Ellis",
    type: "Family",
    age: 58,
    phone: "(713) 555-0132",
    email: "mark.ellis@example.com",
    city: "Houston",
    state: "TX",
    zip: "77005",
    latitude: 29.7174,
    longitude: -95.4018,
    notes: "Son. Helps review contracts and finances."
  },
  {
    id: "person-linda",
    name: "Linda Parker",
    type: "Friend",
    age: 81,
    phone: "(512) 555-0188",
    email: "linda.parker@example.com",
    city: "Austin",
    state: "TX",
    zip: "78703",
    latitude: 30.2933,
    longitude: -97.7688,
    notes: "Neighbor and social support."
  },
  {
    id: "person-shah",
    name: "Dr. Priya Shah",
    type: "Doctor",
    age: 47,
    phone: "(512) 555-0154",
    email: "pshah@exampleclinic.org",
    city: "Austin",
    state: "TX",
    zip: "78731",
    latitude: 30.3443,
    longitude: -97.7506,
    notes: "Primary care physician."
  },
  {
    id: "person-ortiz",
    name: "Daniel Ortiz",
    type: "Resident",
    age: 77,
    phone: "(512) 555-0144",
    email: "daniel.ortiz@example.com",
    city: "Round Rock",
    state: "TX",
    zip: "78664",
    latitude: 30.5083,
    longitude: -97.6789,
    notes: "Touring communities north of Austin."
  },
  {
    id: "person-elena",
    name: "Elena Ortiz",
    type: "Family",
    age: 49,
    phone: "(512) 555-0122",
    email: "elena.ortiz@example.com",
    city: "Cedar Park",
    state: "TX",
    zip: "78613",
    latitude: 30.5052,
    longitude: -97.8203,
    notes: "Niece. Coordinates tours and transportation."
  },
  {
    id: "person-nguyen",
    name: "Patricia Nguyen",
    type: "Resident",
    age: 72,
    phone: "(512) 555-0175",
    email: "patricia.nguyen@example.com",
    city: "Cedar Park",
    state: "TX",
    zip: "78613",
    latitude: 30.5125,
    longitude: -97.8191,
    notes: "Evaluating independent living versus assisted living."
  },
  {
    id: "person-anthony",
    name: "Anthony Nguyen",
    type: "Family",
    age: 44,
    phone: "(737) 555-0182",
    email: "anthony.nguyen@example.com",
    city: "Leander",
    state: "TX",
    zip: "78641",
    latitude: 30.5788,
    longitude: -97.8531,
    notes: "Son. Wants options near Cedar Park."
  },
  {
    id: "person-kim",
    name: "Robert Kim",
    type: "Resident",
    age: 86,
    phone: "(512) 555-0106",
    email: "robert.kim@example.com",
    city: "Austin",
    state: "TX",
    zip: "78757",
    latitude: 30.3518,
    longitude: -97.7331,
    notes: "Needs secure memory care."
  },
  {
    id: "person-julia",
    name: "Julia Kim",
    type: "Family",
    age: 52,
    phone: "(512) 555-0171",
    email: "julia.kim@example.com",
    city: "Austin",
    state: "TX",
    zip: "78745",
    latitude: 30.2064,
    longitude: -97.8008,
    notes: "Niece and local caregiver."
  },
  {
    id: "person-mendoza",
    name: "Dr. Carlos Mendoza",
    type: "Doctor",
    age: 61,
    phone: "(512) 555-0169",
    email: "cmendoza@examplememory.org",
    city: "Austin",
    state: "TX",
    zip: "78705",
    latitude: 30.2915,
    longitude: -97.7389,
    notes: "Neurologist involved in memory-care paperwork."
  },
  {
    id: "person-jordan",
    name: "Jordan Miller",
    type: "Facility contact",
    age: 39,
    phone: "(512) 555-0160",
    email: "jordan.miller@example.com",
    city: "Austin",
    state: "TX",
    zip: "78746",
    latitude: 30.2675,
    longitude: -97.7876,
    notes: "Community relations contact."
  }
];

export const SAMPLE_RELATIONSHIPS = [
  { id: "rel-001", from: "person-margaret", to: "person-renee", type: "Family", label: "Daughter", strength: "Primary" },
  { id: "rel-002", from: "person-margaret", to: "person-mark", type: "Family", label: "Son", strength: "Secondary" },
  { id: "rel-003", from: "person-margaret", to: "person-linda", type: "Friend", label: "Neighbor", strength: "Support" },
  { id: "rel-004", from: "person-margaret", to: "person-shah", type: "Doctor", label: "Primary care", strength: "Clinical" },
  { id: "rel-005", from: "person-renee", to: "person-jordan", type: "Facility contact", label: "Tour contact", strength: "Active" },
  { id: "rel-006", from: "person-ortiz", to: "person-elena", type: "Family", label: "Niece", strength: "Primary" },
  { id: "rel-007", from: "person-nguyen", to: "person-anthony", type: "Family", label: "Son", strength: "Primary" },
  { id: "rel-008", from: "person-kim", to: "person-julia", type: "Family", label: "Niece", strength: "Primary" },
  { id: "rel-009", from: "person-kim", to: "person-mendoza", type: "Doctor", label: "Neurologist", strength: "Clinical" },
  { id: "rel-010", from: "person-julia", to: "person-jordan", type: "Facility contact", label: "Application packet", strength: "Active" },
  { id: "rel-011", from: "person-renee", to: "person-julia", type: "Friend", label: "Caregiver referral", strength: "Light" },
  { id: "rel-012", from: "person-shah", to: "person-mendoza", type: "Doctor", label: "Referral", strength: "Professional" }
];
