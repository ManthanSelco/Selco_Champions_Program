import { Link } from 'react-router-dom';

export default function Logo({ compact = false, to = '/' }) {
  return (
    <Link to={to} className="group flex items-center gap-3">
      <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-card ring-1 ring-black/5 transition group-hover:rotate-[-4deg]">
        <img src="selco-logo.png" alt="SELCO Foundation" className="h-9 w-9 object-contain" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-bold tracking-tight text-ink">SELCO Foundation</span>
          <span className="block text-[11.5px] font-medium text-ink-mute">Champion End Users · Karnataka</span>
        </span>
      )}
    </Link>
  );
}
