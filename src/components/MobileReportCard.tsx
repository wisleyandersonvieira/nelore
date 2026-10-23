import React from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface MobileReportField {
  label: string;
  value?: React.ReactNode | null;
  valueClassName?: string;
}

interface MobileReportCardProps {
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  detailFields?: MobileReportField[];
  summaryFields: MobileReportField[];
  subtitle?: React.ReactNode;
  title: React.ReactNode;
  titleAside?: React.ReactNode;
}

const FALLBACK_TEXT = "Não informado";

const hasVisibleValue = (value: React.ReactNode | null | undefined) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const renderFieldValue = (value: React.ReactNode | null | undefined) => {
  if (!hasVisibleValue(value)) {
    return <span className="text-muted-foreground">{FALLBACK_TEXT}</span>;
  }

  return value;
};

const FieldList = ({ fields }: { fields: MobileReportField[] }) => (
  <div className="space-y-3">
    {fields.map((field) => (
      <div key={field.label} className="flex items-start justify-between gap-4">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
          {field.label}
        </span>
        <div className={cn("max-w-[68%] text-right text-sm text-foreground", field.valueClassName)}>
          {renderFieldValue(field.value)}
        </div>
      </div>
    ))}
  </div>
);

const MobileReportCard = ({
  actions,
  badge,
  detailFields = [],
  summaryFields,
  subtitle,
  title,
  titleAside,
}: MobileReportCardProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold leading-tight text-foreground">{title}</h3>
                  {badge}
                </div>
                {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
              </div>
              {titleAside ? <div className="shrink-0 text-right">{titleAside}</div> : null}
            </div>

            <FieldList fields={summaryFields} />

            {actions ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
                {actions}
              </div>
            ) : null}

            {detailFields.length > 0 ? (
              <>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="group h-auto w-full justify-between rounded-xl border border-border/70 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
              >
                {open ? "Ocultar detalhes" : "Ver detalhes"}
                <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <FieldList fields={detailFields} />
              </div>
            </CollapsibleContent>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Collapsible>
  );
};

export default MobileReportCard;
