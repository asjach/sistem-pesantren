import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Keadaan kosong seragam: ikon (opsional) + judul + deskripsi + aksi
 * (opsional). Menggantikan teks "Belum ada ..." yang selama ini diulang
 * per halaman dengan suara & tata letak yang berbeda-beda.
 */
export interface EmptyStateProps {
  /** Ikon di atas judul (biasanya ikon berukuran ~40px, netral). */
  icon?: React.ReactNode
  /** Judul singkat, wajib. */
  title: React.ReactNode
  /** Penjelasan satu-dua kalimat (opsional). */
  description?: React.ReactNode
  /** Tombol atau tautan tindakan (opsional), mis. "Tambah". */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-8 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-1 text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
