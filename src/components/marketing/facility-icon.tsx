import { Armchair, CircleParking, Droplets, Dumbbell, Layers, LayoutGrid, Lightbulb, Shirt, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  courts: LayoutGrid,
  lighting: Lightbulb,
  flooring: Layers,
  seating: Armchair,
  changing: Shirt,
  water: Droplets,
  parking: CircleParking,
  equipment: Dumbbell,
};

export function FacilityIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? LayoutGrid;
  return <Icon className={className} aria-hidden />;
}
