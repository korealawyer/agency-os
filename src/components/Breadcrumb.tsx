"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className="breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="breadcrumb-segment">
          {i > 0 && <ChevronRight size={14} className="breadcrumb-separator" />}
          {item.href ? (
            <Link href={item.href} className="breadcrumb-link">{item.label}</Link>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
