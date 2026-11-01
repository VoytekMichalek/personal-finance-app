import { useState } from "react";
import { Palette, Undo2 } from "lucide-react";
import { uniqueCategoryColours, type Category } from "@finance/shared";
import { useAction } from "../../hooks/data";
import { ActionError } from "../common/ActionError";
import { ContextTip } from "../common/ContextTip";
import { Button } from "../ui/button";
type Change = { id: string; color: string; expectedColor: string };
export function AssignColours({ categories }: { categories: Category[] }) {
  const [undo, setUndo] = useState<Change[]>();
  const action = useAction();
  const apply = () => {
    const changes = uniqueCategoryColours(categories).map((c) => ({
      ...c,
      expectedColor: categories.find((item) => item.id === c.id)!.color,
    }));
    action.mutate(
      { path: "/categories/colours", method: "PUT", body: { changes } },
      {
        onSuccess: () =>
          setUndo(
            changes.map((c) => ({
              id: c.id,
              color: c.expectedColor,
              expectedColor: c.color,
            })),
          ),
      },
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={action.isPending || !categories.length}
        onClick={apply}
      >
        <Palette size={14} />
        {action.isPending ? "Saving colours…" : "Assign unique colours"}
      </Button>
      <ContextTip label="category colours">
        Assigns a distinct colour to every category, including archived
        categories and those outside this search. Replaces existing colours.
        Undo restores the previous colours during this visit.
      </ContextTip>
      {undo && (
        <Button
          variant="ghost"
          size="sm"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(
              {
                path: "/categories/colours",
                method: "PUT",
                body: { changes: undo },
              },
              { onSuccess: () => setUndo(undefined) },
            )
          }
        >
          <Undo2 size={14} />
          Undo colours
        </Button>
      )}
      {action.isSuccess && (
        <span role="status" className="text-xs text-muted-foreground">
          Colours saved
        </span>
      )}
      {action.error && (
        <div className="basis-full">
          <ActionError error={action.error} />
          <p className="text-xs text-muted-foreground">
            Use Assign unique colours again after refreshing, or retry Undo if
            the saved colours are unchanged.
          </p>
        </div>
      )}
    </div>
  );
}
