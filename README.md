# Yukty AI · Swarm OS

A scroll-driven 3D walkthrough for pitching the Yukty AI student initiative and
Swarm Intelligence workshop to universities. One version is used for every institution.

The site looks like live swarm-intelligence software: a mission-control HUD over a
glassy night-time lake that mirrors every drone. A drone swarm first forms the Yukty logo, then flies one mission per
section of the collaboration email (missions 04 and 05 hold playable ACO and PSO demos).

## Edit the content

Everything editable is in `src/config/yukty.ts`:

- `company`: email, phone, address
- `socials`: Instagram, Facebook and LinkedIn handles and URLs
- `programme`: workshop duration, internship duration, stipend, working hours
- `chapters`: the text, mission code and terminal log of every mission

Values in `[square brackets]` are placeholders. On the page they show with a dashed
amber outline until you replace them. Social cards become clickable links, and the
"Schedule a meeting" button becomes a mailto link, once real values are set.

## Run

```bash
npm install
npm run dev
```

`npm run build` produces a fully static site that can be deployed to Vercel or any static host.

## Presenting

Arrow keys, Page Up/Down, Space or a presentation clicker move one mission at a time.
The mission list on the right jumps straight to a mission.
