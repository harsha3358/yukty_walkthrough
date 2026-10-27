// Every editable fact in the walkthrough lives here.
// Values wrapped in [square brackets] are placeholders — replace them before sharing.

export const company = {
  name: "Yukty AI Solutions",
  shortName: "YUKTY",
  website: "https://yukty.com/",
  // The first email receives "Schedule a meeting" requests.
  emails: ["hr@yukty.com", "meghanaseram@yukty.com"],
  phones: ["+91 91218 88140", "+91 91218 88139"],
  mapUrl: "https://maps.app.goo.gl/R2y4dxC39tji4KH47",
};

export const socials = [
  { label: "Instagram", handle: "@yukty.ai", url: "https://www.instagram.com/yukty.ai/" },
  { label: "Facebook", handle: "Yukty AI Solutions Pvt Ltd", url: "https://www.facebook.com/people/Yukty-AI-Solutions-Pvt-Ltd/61595995527504/" },
  { label: "LinkedIn", handle: "Yukty AI Solutions", url: "https://www.linkedin.com/in/yukty-ai-solutions" },
  // To add X later: { label: "X", handle: "@your-handle", url: "https://x.com/your-handle" },
];

export const programme = {
  workshopDuration: "3 hours",
  internshipDuration: "3 months",
  workingHours: "9:30 AM – 6:30 PM",
  participationFee: "₹0",
};

export const isPlaceholder = (value: string) => value.startsWith("[") && value.endsWith("]");

export type Chapter = {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  points?: string[];
  demo?: "aco" | "pso";
};

export const chapters: Chapter[] = [
  {
    id: "arrival",
    kicker: "Enter the colony",
    title: "Welcome to Yukty AI",
    lead:
      "Thousands of simple minds. One brilliant idea. Scroll to travel through the colony — every chamber is one part of the collaboration we are proposing for your students.",
  },
  {
    id: "who",
    kicker: "Who we are",
    title: "A tunnel between industry and campus",
    lead:
      "Yukty AI Solutions runs a student development initiative built around industry-oriented training, internships, placement assistance and career development in emerging technologies.",
  },
  {
    id: "pillars",
    kicker: "What we bring",
    title: "Three pillars for every student",
    lead: "One initiative, three outcomes that build on each other.",
    points: [
      "Training: structured, industry-relevant programmes",
      "Internships: real projects with real mentors",
      "Placement: assistance and guidance into career pathways",
    ],
  },
  {
    id: "swarm",
    kicker: "The workshop topic",
    title: "What is Swarm Intelligence?",
    lead:
      "Ants, bees, birds and fish have no leader, yet together they solve hard problems. Swarm Intelligence turns that collective behaviour into algorithms that power modern AI.",
    points: ["Decentralised agents", "Simple local rules", "Emergent global intelligence"],
  },
  {
    id: "aco",
    kicker: "Hands-on · Algorithm 01",
    title: "Ant Colony Optimization",
    lead:
      "Ants leave pheromone on the paths they walk. Shorter paths get reinforced faster, so the colony converges on the best route. Tap a node to move the food.",
    demo: "aco",
  },
  {
    id: "pso",
    kicker: "Hands-on · Algorithm 02",
    title: "Particle Swarm Optimization",
    lead:
      "Each particle remembers its best spot and listens to the swarm's best. Together they find the lowest valley in the landscape. Tap anywhere to move the target.",
    demo: "pso",
  },
  {
    id: "applications",
    kicker: "Where it's used",
    title: "From ant hills to drone fleets",
    lead: "The same principles run some of today's most exciting systems.",
    points: [
      "Artificial Intelligence & optimisation",
      "Robotics & warehouse automation",
      "Drone technology & light shows",
      "Autonomous vehicles",
      "Multi-agent systems",
    ],
  },
  {
    id: "workshop",
    kicker: "The workshop",
    title: "Learn it. Build it. Present it.",
    lead: `Duration: ${programme.workshopDuration}. Structure, requirements and approval are finalised with your placement team.`,
    points: [
      "Introduction to Yukty AI & the student initiative",
      "Swarm Intelligence fundamentals: ACO & PSO",
      "Live demonstrations & hands-on activities",
      "Mini-project ideas students can continue",
      "Industry use cases & future careers",
    ],
  },
  {
    id: "internship",
    kicker: "Internship & platform",
    title: "Zero fee. Real experience.",
    lead:
      "Students join our learning platform with no participation fee, then move into internships through a clear selection process.",
    points: [
      `Participation fee: ${programme.participationFee}`,
      `Internship duration: ${programme.internshipDuration}`,
      `Working hours: ${programme.workingHours}`,
      "Selection: Workshop → Assessment → Interview → Offer",
    ],
  },
  {
    id: "careers",
    kicker: "Where students go next",
    title: "A constellation of careers",
    lead:
      "AI Engineer · Robotics Developer · Drone Systems Engineer · Autonomous Systems Researcher · Multi-Agent Systems Developer · Data Scientist",
  },
  {
    id: "ask",
    kicker: "Surface",
    title: "Let's build this colony together",
    lead:
      "We would welcome a suitable time slot to present the initiative to your Placement Team and HR representatives and to discuss the proposed workshop.",
  },
];
