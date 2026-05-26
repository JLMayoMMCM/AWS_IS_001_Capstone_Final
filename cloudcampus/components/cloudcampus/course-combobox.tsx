"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface CourseOption {
  id: string;
  name: string;
}

/**
 * Searchable course picker. Replaces the V1 free-text input with a strict
 * dropdown bound to the `courses` lookup so member rows always reference a
 * known course id (V2.1 §3). The selected id is rendered into a hidden input
 * with the given `name` so it submits with the surrounding form.
 */
export function CourseCombobox({
  courses,
  defaultValue,
  name = "courseId",
  placeholder = "Select a course",
  disabled,
}: {
  courses: CourseOption[];
  defaultValue?: string | null;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(defaultValue ?? null);
  const selected = courses.find((c) => c.id === value);

  return (
    <>
      <input type="hidden" name={name} value={value ?? ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.name : placeholder}
            </span>
            <ChevronsUpDown className="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search courses…" />
            <CommandList>
              <CommandEmpty>No course matches that search.</CommandEmpty>
              <CommandGroup>
                {courses.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      setValue(c.id === value ? null : c.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        c.id === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
