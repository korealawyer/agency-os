"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presets = [
  { label: "오늘", days: 0 },
  { label: "어제", days: 1 },
  { label: "최근 7일", days: 7 },
  { label: "최근 30일", days: 30 },
  { label: "최근 90일", days: 90 },
  { label: "이번 달", days: -1 },
];

function daysAgo(n: number): DateRange {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date();
  if (n === 0) { start.setHours(0, 0, 0, 0); }
  else if (n === 1) { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999); }
  else { start.setDate(start.getDate() - n + 1); start.setHours(0, 0, 0, 0); }
  return { start, end };
}

function thisMonth(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShort(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(d: Date, start: Date, end: Date) {
  return d >= start && d <= end;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(value.start.getMonth());
  const [viewYear, setViewYear] = useState(value.start.getFullYear());
  const [selecting, setSelecting] = useState<"start" | "end" | null>(null);
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePreset = (preset: typeof presets[number]) => {
    const range = preset.days === -1 ? thisMonth() : daysAgo(preset.days);
    onChange(range);
    setOpen(false);
  };

  const handleDayClick = (day: number) => {
    const clicked = new Date(viewYear, viewMonth, day);
    if (!selecting || selecting === "start") {
      setTempStart(clicked);
      setSelecting("end");
    } else {
      if (tempStart && clicked >= tempStart) {
        const end = new Date(clicked); end.setHours(23, 59, 59, 999);
        onChange({ start: tempStart, end });
      } else if (tempStart) {
        const end = new Date(tempStart); end.setHours(23, 59, 59, 999);
        onChange({ start: clicked, end });
      }
      setSelecting(null);
      setTempStart(null);
      setOpen(false);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const days = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

  return (
    <div className="daterange-picker" ref={ref}>
      <button className="daterange-trigger" onClick={() => { setOpen(!open); setSelecting("start"); }}>
        <Calendar size={16} />
        <span>{formatShort(value.start)} — {formatShort(value.end)}</span>
      </button>

      {open && (
        <div className="daterange-dropdown">
          <div className="daterange-presets">
            {presets.map(p => (
              <button key={p.label} className="daterange-preset-btn" onClick={() => handlePreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="daterange-calendar">
            <div className="daterange-cal-header">
              <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
              <span className="daterange-cal-title">{viewYear}년 {monthNames[viewMonth]}</span>
              <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>
            <div className="daterange-cal-weekdays">
              {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                <div key={d} className="daterange-cal-wd">{d}</div>
              ))}
            </div>
            <div className="daterange-cal-days">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: days }).map((_, i) => {
                const day = i + 1;
                const date = new Date(viewYear, viewMonth, day);
                const isStart = isSameDay(date, tempStart || value.start);
                const isEnd = isSameDay(date, value.end);
                const inRange = isBetween(date, tempStart || value.start, value.end);
                const isToday = isSameDay(date, new Date());
                return (
                  <button
                    key={day}
                    className={`daterange-cal-day${isStart || isEnd ? " selected" : ""}${inRange && !isStart && !isEnd ? " in-range" : ""}${isToday ? " today" : ""}`}
                    onClick={() => handleDayClick(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="daterange-cal-footer">
              {formatDate(tempStart || value.start)} — {selecting === "end" ? "종료일 선택" : formatDate(value.end)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
