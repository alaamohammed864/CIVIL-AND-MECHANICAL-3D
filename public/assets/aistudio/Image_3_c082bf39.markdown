---
name: Petroleum Telemetry & Industrial Engineering System
colors:
  surface: '#0b141e'
  surface-dim: '#0b141e'
  surface-bright: '#313a45'
  surface-container-lowest: '#060f18'
  surface-container-low: '#131c26'
  surface-container: '#17202b'
  surface-container-high: '#222b35'
  surface-container-highest: '#2d3640'
  on-surface: '#dae3f1'
  on-surface-variant: '#bbc9cf'
  inverse-surface: '#dae3f1'
  inverse-on-surface: '#28313c'
  outline: '#859399'
  outline-variant: '#3c494e'
  surface-tint: '#47d6ff'
  primary: '#a5e7ff'
  on-primary: '#003543'
  primary-container: '#00d2ff'
  on-primary-container: '#00566a'
  inverse-primary: '#00677f'
  secondary: '#ffb86b'
  on-secondary: '#492900'
  secondary-container: '#ed9000'
  on-secondary-container: '#583300'
  tertiary: '#69f6b9'
  on-tertiary: '#003824'
  tertiary-container: '#48d99e'
  on-tertiary-container: '#005b3d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b6ebff'
  primary-fixed-dim: '#47d6ff'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#004e60'
  secondary-fixed: '#ffdcbc'
  secondary-fixed-dim: '#ffb86b'
  on-secondary-fixed: '#2c1700'
  on-secondary-fixed-variant: '#683d00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b141e'
  on-background: '#dae3f1'
  surface-variant: '#2d3640'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0em
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  telemetry-data:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
  label-mono-xs:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system is tailored for mission-critical industrial engineering education, focusing on petroleum, oil, and gas telemetry operations. The UI evokes the calculated, high-consequence atmosphere of a modern offshore drilling rig control console and automated petrochemical refinery command center. 

The aesthetic synthesizes **Tactile Industrial Precision** with **Futuristic Telemetry Minimalism**:
- **Target Audience:** Petroleum engineers, instrumentation technicians, process operators, and engineering students working through complex process simulations, SCADA interfaces, and piping & instrumentation diagrams (P&IDs).
- **Emotional Response:** High operational focus, analytical clarity, technical authority, and calm in complex operating environments.
- **Design Style:** Deep charcoal/slate substrates punctuated by luminous engineering signal hues. The UI favors structural precision, micro-grid technical alignment, monospaced metadata, segmented readouts, and tactical borders that evoke physical control panels without skeumorphic clutter. Full bi-directional layout architecture natively supports Arabic-first technical learning alongside dense alphanumeric engineering telemetry.

## Colors

The palette is engineered for high visual endurance under prolonged low-light monitoring conditions, avoiding eye fatigue while guaranteeing immediate visual triage.

### Palette Architecture
- **Primary (`#00D2FF` - Hydrocarbon Cyan):** System nominal status, interactive telemetry pointers, schematic flow lines, active states, and focal user interactions.
- **Secondary (`#FF9F1C` - Hazard Amber):** Process warnings, flow rate throttles, operational alerts, and dynamic mechanical stress thresholds.
- **Tertiary (`#10B981` - Valve Open / Safe Green):** Stable telemetry parameters, operational safety verifications, confirmed valve positions, and normal diagnostic ranges.
- **Critical Error (`#EF4444` - Emergency Shutdown Ruby):** Overpressure warnings, blowout preventer triggers, system interlocks, and critical test failures.
- **Backgrounds & Tonal Layers:**
  - `Base Canvas`: `#0B1118` (Deep Abyssal Petroleum Slate)
  - `Surface 1 (Console Chassis)`: `#111A24` (Subsea Charcoal)
  - `Surface 2 (Telemetry Panel)`: `#1B2636` (Elevated Panel Slate)
  - `Surface 3 (Active Interlock)`: `#243348` (Instrument Hover/Focus Slate)
- **Text & Telemetry Neutral:**
  - `Text Primary`: `#F0F4F8` (Off-white Luminescent)
  - `Text Secondary`: `#8B9CB2` (Passivated Steel)
  - `Text Muted / Grid`: `#38495E` (Subsea Wireframe)

### Usage Rules
Signal colors (`#00D2FF`, `#FF9F1C`, `#10B981`, `#EF4444`) must never be applied as large background floods. They function strictly as active indicators, telemetry paths, warning borders, dynamic gauges, and data highlights against the dark chassis.

## Typography

Typography establishes an uncompromising technical hierarchy. Text balances high-readability continuous instructional content with ultra-crisp, monospaced instrument readouts.

### Script Pairing & Bi-Directional (RTL) Guidelines
- **Latin Typography:** Space Grotesk anchors high-level technical modules and module headers with geometric precision. Inter serves as the workhorse for dense operational guides, procedures, and interactive documentation. JetBrains Mono delivers all sensor readings, pressures (psi/bar), temperatures (°C/°F), flow rates (bpd/m³h), and coordinates.
- **Arabic Typography:** In Arabic-enabled regions, body copy and headlines transition smoothly into Tajawal or Cairo. Space Grotesk headline weights pair directly with Cairo (Medium/Bold), while Inter body copy pairs with Tajawal (Regular/Medium) at +1px optical height compensation.
- **Monospace Alignment:** JetBrains Mono figures remain in strict tabular alignment regardless of layout direction (LTR or RTL), ensuring telemetry numbers, status hexes, and decimal points line up vertically down data columns.
- **Text Transformations:** Engineering badges, parameter flags, and schematic labels use uppercase styling with positive tracking (`0.05em` to `0.08em`) to mimic etched physical instrument tags.

## Layout & Spacing

The layout is built upon an 8px base grid rhythm (with a 4px sub-grid for precise telemetry metrics, gauge bars, and terminal borders).

### Grid Infrastructure
- **Desktop (1440px and above):** 12-column dynamic SCADA grid. Left/Right technical drawers (collapsible process parameters, live flow rates) flank a wide interactive canvas (3D borehole simulations, pipeline P&ID flowcharts). Margins: `2rem`, Gutters: `1.5rem`.
- **Tablet (768px - 1439px):** 8-column layout. Drawers convert to bottom docked telemetry cards and swipeable parameter sheets. Margins: `1.5rem`, Gutters: `1rem`.
- **Mobile (< 768px):** 4-column single-stream telemetry stack. Control consoles compress into tabbed segment arrays with persistent bottom safety status bars. Margins: `1rem`, Gutters: `0.75rem`.

### Spacing Philosophy
- `space-xs` (4px) & `space-sm` (8px): Micro-spacing for segmented LED ticks, tag paddings, and metric-to-unit lockups.
- `space-md` (16px) & `space-lg` (24px): Standard component padding for instrument panels, control modules, and module step containers.
- `space-xl` (32px) & `space-2xl` (48px): Major zone demarcation between global telemetry status rails and working simulation stages.

## Elevation & Depth

To avoid visual ambiguity typical of fuzzy drop shadows in low-light industrial contexts, the design system utilizes **Tonal Surface Hierarchy** paired with **Razor-Sharp Technical Stroke Accents**.

### Surface Depths
1. **Level 0 (Canvas Base):** `#0B1118` — The primary bedrock. No shadow, flat, non-reflective.
2. **Level 1 (Docked Consoles & Modules):** `#111A24` — Framed with a 1px border of `#1E2B3D`.
3. **Level 2 (Active Telemetry Cards & Wells):** `#1B2636` — Micro-recessed or micro-extruded. Border: 1px `#2C3F58`. 
4. **Level 3 (Modal Overrides & Diagnostic Floating Drawers):** `#1B2636` with an inner-glow border (`#00D2FF` at 25% opacity) and an ambient dark halo: `0 12px 32px -4px rgba(0, 0, 0, 0.75)`.

### Schematic Cutouts & Glows
- **Telemetry Indicators:** Active valves or energized drill strings feature a disciplined, narrow focal glow: `box-shadow: 0 0 10px rgba(0, 210, 255, 0.35)`.
- **Hazard Triggers:** Active alarms project a subtle, pulsating warning aura: `box-shadow: 0 0 12px rgba(255, 159, 28, 0.4)`.
- **Surface Inset:** Metric input wells and simulated terminal viewports use an inset border: `box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6)`.

## Shapes

The design system prioritizes a **Soft-Edged Architectural Chiseled** geometry (Level 1: 0.25rem / 4px base radius). 

### Shape Grammar
- Standard container corners are set to `4px` (`0.25rem`). Large dashboards and workspace monitors use `8px` (`0.5rem`).
- **Chamfered Industrial Accents:** Key telemetry modules, run buttons, and diagnostic modal corners may incorporate a 45-degree chamfered top-right or bottom-left notch (4px to 6px) to emulate the CNC-machined framing of ruggedized hardware consoles.
- **No Pill Shapes:** Pill shapes degrade the professional telemetry character and are strictly prohibited, except for circular LED status beacons (diameter: 6px to 8px).

## Components

### 1. Tactile Push & Rocker Buttons
- **Primary Action (Engage/Test):** Background `#00D2FF` with `#0B1118` bold typography. Hover creates a brightness lift to `#33DBFF` with a cyan outer halo. Active state depresses `1px` downward.
- **Emergency / Interlock Actions:** Dark `#1B2636` surface with a 1px `#EF4444` border, `#EF4444` label, and an optional diagonal hazard-stripe corner tab.
- **Secondary / Tactical Toggles:** Dark steel `#111A24` chassis with 1px `#2C3F58` border. When toggled "ON", a 2px `#10B981` status strip illuminates on the top edge.

### 2. Telemetry Cards & Metric Blocks
- Structured containers with a 1px border (`#1E2B3D`).
- Card header features an uppercase monospaced parameter label (e.g., `ANNULAR_PRESS_01`), a live connection pulse icon, and an optional 3-letter sensor ID code.
- Core value is presented in high-contrast monospaced font accompanied by an engineering unit badge (e.g., `PSI`, `BBL/MIN`, `RPM`) in muted steel text (`#8B9CB2`).

### 3. Segmented Gauges & Progress Meters
- Digital bar graphs divided into distinct rectangular ticks (segments) separated by 2px gaps, rather than smooth gradient fills.
- Safe zone (0–70%) renders in `#10B981` or `#00D2FF`. Caution zone (70–90%) shifts to `#FF9F1C`. Danger zone (90–100%) flashes in `#EF4444`.

### 4. Interactive Schematic Connectors & P&ID Chips
- Flow chips indicate the phase of matter (Crude, Natural Gas, Slurry, Cooling Water) with color-coded 2px borders.
- Clickable nodes display valve states: `OPEN` (solid `#10B981`), `THROTTLED` (dashed `#FF9F1C`), or `ISOLATED/CLOSED` (solid `#EF4444` with a diagonal strike).

### 5. Input Fields & Calibration Sliders
- Inputs feature deep recessed wells (`#0B1118`), 1px borders (`#2C3F58`), and fixed tabular monospace text.
- Focused inputs illuminate with a `#00D2FF` 1px border. Numeric adjustments feature increment/decrement micro-stepper buttons integrated directly into the frame.
- Calibration sliders use a textured metal handle, a grooved runner track (`#0B1118`), and segmented step marks underneath.

### 6. Lists & Diagnostic Telemetry Logs
- Alternating subtle rows (`#111A24` and `#141F2B`) with 1px horizontal borders.
- Timestamps render in `JetBrains Mono` at `#8B9CB2`.
- Severity chips (INFO, WARN, CRIT) use bracketed monospace notations: `[ OK ]`, `[ WARN ]`, `[ FAIL ]` with their respective signaling colors.