# Yukty AI · The Colony

A scroll-driven 3D walkthrough for pitching the Yukty AI student initiative and
Swarm Intelligence workshop to universities. One version is used for every institution.

Visitors descend through a glowing ant-colony tunnel. Each of the 11 chambers covers
one part of the collaboration email, and chambers 4 and 5 hold playable ACO and PSO demos.

## Edit the content

Everything editable is in `src/config/yukty.ts`:

- `company`: email, phone, address
- `socials`: Instagram, Facebook and LinkedIn handles and URLs
- `programme`: workshop duration, internship duration, stipend, working hours
- `chapters`: the text of every chamber

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

Arrow keys, Page Up/Down, Space or a presentation clicker move one chamber at a time.
The dots on the right jump straight to a chamber.
