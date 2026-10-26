// Every editable fact in the walkthrough lives here.
// Values wrapped in [square brackets] are placeholders — replace them before sharing.

export const company = {
  name: "Yukty AI Solutions",
  shortName: "YUKTY",
  website: "https://yukty.com/",
  email: "[contact@yukty.com]",
  phone: "[+91 00000 00000]",
  address: "[Office address, City]",
};

export const socials = [
  { label: "Instagram", handle: "[@yukty.ai]", url: "[https://instagram.com/your-handle]" },
  { label: "Facebook", handle: "[Yukty AI Solutions]", url: "[https://facebook.com/your-page]" },
  { label: "LinkedIn", handle: "[Yukty AI Solutions]", url: "[https://linkedin.com/company/your-page]" },
];

export const programme = {
  workshopDuration: "[e.g. 1 day · 6 hours]",
  internshipDuration: "[e.g. 3 months]",
  stipend: "[₹ amount / month]",
  workingHours: "[e.g. 4 hrs/day, flexible]",
  participationFee: "₹0",
};

export const isPlaceholder = (value: string) => value.startsWith("[") && value.endsWith("]");

export type Chapter = {
  id: string;
  // Mission code and terminal lines shown in the Swarm OS HUD.
  code: string;
  log: string[];
  kicker: string;
  title: string;
  lead: string;
  points?: string[];
  demo?: "aco" | "pso";
};

export const chapters: Chapter[] = [
  {
    id: "arrival",
    code: "BOOT",
    log: ["swarm.boot --agents 480", "calibrating formation: LOGO", "status: ONLINE"],
    kicker: "Boot sequence",
    title: "Welcome to Yukty AI",
    lead:
      "Thousands of simple agents. One intelligent system. Scroll to run the missions — each one is part of the collaboration we are proposing for your students.",
  },
  {
    id: "who",
    code: "LINK",
    log: ["link.establish(industry, campus)", "handshake ok · latency 12ms"],
    kicker: "Who we are",
    title: "A live link between industry and campus",
    lead:
      "Yukty AI Solutions runs a student development initiative built around industry-oriented training, internships, placement assistance and career development in emerging technologies.",
  },
  {
    id: "pillars",
    code: "CORE",
    log: ["load modules: training, internship, placement", "3/3 modules active"],
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
    code: "FLOCK",
    log: ["mode = emergent", "rules: separation · alignment · cohesion", "no leader detected — as designed"],
    kicker: "The workshop topic",
    title: "What is Swarm Intelligence?",
    lead:
      "Ants, bees, birds and fish have no leader, yet together they solve hard problems. Swarm Intelligence turns that collective behaviour into algorithms that power modern AI.",
    points: ["Decentralised agents", "Simple local rules", "Emergent global intelligence"],
  },
  {
    id: "aco",
    code: "ROUTE",
    log: ["aco.solve(hub → drop)", "pheromone reinforced on shortest path", "best route locked"],
    kicker: "Hands-on · Algorithm 01",
    title: "Ant Colony Optimization",
    lead:
      "Ants leave pheromone on the paths they walk. Shorter paths get reinforced faster, so the colony converges on the best route. Tap a node to move the food.",
    demo: "aco",
  },
  {
    id: "pso",
    code: "SEEK",
    log: ["pso.search(target = hotspot)", "gbest updated · swarm converging"],
    kicker: "Hands-on · Algorithm 02",
    title: "Particle Swarm Optimization",
    lead:
      "Each particle remembers its best spot and listens to the swarm's best. Together they find the lowest valley in the landscape. Tap anywhere to move the target.",
    demo: "pso",
  },
  {
    id: "applications",
    code: "DEPLOY",
    log: ["deploy: ai · robotics · drones · autonomy · mas", "light-show sequence running"],
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
    code: "TRAIN",
    log: ["workshop.schedule(sessions = 5)", "hands-on kits ready"],
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
    code: "ENLIST",
    log: ["participation_fee = ₹0", "pipeline: workshop → assessment → interview → offer"],
    kicker: "Internship & platform",
    title: "Zero fee. Real experience.",
    lead:
      "Students join our learning platform with no participation fee, then move into internships through a clear selection process.",
    points: [
      `Participation fee: ${programme.participationFee}`,
      `Internship duration: ${programme.internshipDuration}`,
      `Stipend: ${programme.stipend}`,
      `Working hours: ${programme.workingHours}`,
      "Selection: Workshop → Assessment → Interview → Offer",
    ],
  },
  {
    id: "careers",
    code: "LAUNCH",
    log: ["career.paths = 6", "constellation mapped"],
    kicker: "Where students go next",
    title: "A constellation of careers",
    lead:
      "AI Engineer · Robotics Developer · Drone Systems Engineer · Autonomous Systems Researcher · Multi-Agent Systems Developer · Data Scientist",
  },
  {
    id: "ask",
    code: "CONNECT",
    log: ["awaiting: placement team", "open channel → yukty.com"],
    kicker: "Final mission",
    title: "Let's run this mission together",
    lead:
      "We would welcome a suitable time slot to present the initiative to your Placement Team and HR representatives and to discuss the proposed workshop.",
  },
];
