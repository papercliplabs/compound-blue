import Image from "next/image";

const MAX_ICONS = 6;

interface RowIconsProps {
  icons: { src: string; alt: string }[];
  size: number;
}

export default function RowIcons({ icons, size }: RowIconsProps) {
  const displayIcons = icons.slice(0, MAX_ICONS);
  const remainingCount = Math.max(0, icons.length - MAX_ICONS);

  return (
    <div className="flex items-center">
      {displayIcons.map((icon, i) => (
        <div
          key={i}
          className="rounded-full bg-background-secondary p-[2px]"
          style={{ marginLeft: i === 0 ? 0 : `-${size / 4}px` }}
        >
          <Image src={icon.src} width={size} height={size} alt={icon.alt} className="shrink-0 rounded-full" />
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="rounded-full bg-background-secondary p-[2px]" style={{ marginLeft: `-${size / 4}px` }}>
          <div
            className="flex items-center justify-center rounded-full bg-background-primary text-[10px] text-content-secondary"
            style={{
              width: size,
              height: size,
            }}
          >
            +{remainingCount}
          </div>
        </div>
      )}
    </div>
  );
}
