// Satu pintu util kelas: paket `cn` (drop-in clsx+tailwind-merge) agar konsumen
// tidak ada yang mengimpor langsung dari "cn" (komponen baru shadcn CLI
// memakai alias "@/lib/utils").
export { cn } from "cn"
