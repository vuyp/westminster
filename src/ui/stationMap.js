// Schematic station map shown with the M key (inline SVG, TfL-ish styling).
export function stationMapHTML() {
  return `
  <div style="font-weight:700;font-size:15px;margin-bottom:6px;display:flex;align-items:center;gap:8px">
    <span style="display:inline-block;width:18px;height:18px;border-radius:50%;border:4px solid #dc241f;box-sizing:border-box;position:relative"></span> Westminster — station layout
  </div>
  <svg viewBox="0 0 360 250" width="100%" style="display:block;background:#fff;border:1px solid #ddd;border-radius:4px">
    <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#333"/></marker></defs>
    <!-- street -->
    <rect x="10" y="10" width="340" height="28" fill="#eef1f5" stroke="#bbb"/>
    <text x="16" y="28" font-size="11" font-family="Gill Sans, Helvetica, Arial" fill="#333">Street — Bridge Street · Portcullis House · Big Ben across the road</text>
    <!-- ticket hall -->
    <rect x="10" y="48" width="340" height="34" fill="#f7f7f7" stroke="#bbb"/>
    <text x="16" y="62" font-size="11" font-family="Gill Sans, Helvetica, Arial" fill="#333">Ticket hall (−6.5 m) — gateline, ticket machines, Exits 1–4</text>
    <text x="16" y="76" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#666">Stairs from Bridge Street ↓ · stairs to platforms 1 &amp; 2 ↓ · box overlook ↓</text>
    <!-- district platforms -->
    <rect x="10" y="92" width="200" height="40" fill="#e8f3ec" stroke="#00782a"/>
    <rect x="10" y="92" width="200" height="6" fill="#00782a"/><rect x="10" y="98" width="200" height="6" fill="#ffd300"/>
    <text x="16" y="118" font-size="11" font-family="Gill Sans, Helvetica, Arial" fill="#003d16">District &amp; Circle (−12 m)</text>
    <text x="16" y="129" font-size="9.5" font-family="Gill Sans, Helvetica, Arial" fill="#003d16">Platform 1 eastbound (Embankment) · Platform 2 westbound (St. James's Park)</text>
    <!-- jubilee box -->
    <rect x="220" y="92" width="130" height="148" fill="#f0f1f2" stroke="#7a7f83"/>
    <text x="226" y="106" font-size="11" font-family="Gill Sans, Helvetica, Arial" fill="#333">Jubilee line box</text>
    <text x="226" y="118" font-size="9.5" font-family="Gill Sans, Helvetica, Arial" fill="#555">escalators criss-cross the void</text>
    <line x1="235" y1="122" x2="300" y2="165" stroke="#a0a5a9" stroke-width="4"/>
    <line x1="335" y1="128" x2="250" y2="205" stroke="#a0a5a9" stroke-width="4"/>
    <rect x="226" y="164" width="118" height="20" fill="#a0a5a9" opacity="0.5"/>
    <text x="230" y="178" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#222">Platform 4 · eastbound (−26.5 m)</text>
    <rect x="226" y="206" width="118" height="20" fill="#a0a5a9" opacity="0.5"/>
    <text x="230" y="220" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#222">Platform 3 · westbound (−35 m)</text>
    <text x="226" y="236" font-size="9" font-family="Gill Sans, Helvetica, Arial" fill="#666">platform edge doors · Waterloo ⇄ Green Park</text>
    <!-- legend -->
    <text x="16" y="150" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#333">You are a passenger. Go down from the street, touch in at</text>
    <text x="16" y="162" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#333">the gates, then either take the stairs to the District &amp;</text>
    <text x="16" y="174" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#333">Circle platforms or the escalators down into the box for</text>
    <text x="16" y="186" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#333">the Jubilee line. Board any train when the doors open.</text>
    <text x="16" y="206" font-size="10" font-family="Gill Sans, Helvetica, Arial" fill="#666">Press M to close this map · H toggles the controls help</text>
  </svg>`;
}
