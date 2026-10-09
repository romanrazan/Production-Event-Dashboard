import { Activity, Boxes, Factory, RadioTower } from "lucide-react";
import { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><Factory size={20} /></span><div>NorthBridge<small>PRODUCTION OPS</small></div></div>
        <nav aria-label="Main navigation">
          <a className="active" href="#overview"><Activity size={17} /> Live operations</a>
          <a href="#events"><Boxes size={17} /> Event intake</a>
          <a href="#mqtt"><RadioTower size={17} /> Device link</a>
        </nav>
        <div className="sidebar-note"><strong>Event control</strong><p>Durable production counts, review, corrections and device telemetry.</p></div>
      </aside>
      <div className="workspace">
        <header className="topbar"><span>Factory / Production floor</span><span className="environment">LIVE DATABASE</span></header>
        <main>{children}</main>
        <footer><span>NorthBridge Garments · Operations console</span><span>CSI Smart Tech FSE 01</span></footer>
      </div>
    </div>
  );
}
