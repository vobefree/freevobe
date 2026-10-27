"use client";

import { useRouter } from "next/navigation";

/** Knapp som visar en bekräftelse innan ett tas bort. */
export function ConfirmSubmit({
  action,
  children,
  message,
  className = "btn-link danger",
}: {
  action: string;
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <form
      method="post"
      action={action}
      style={{ display: "inline" }}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        // uppdatera vyn efter att posten gått igenom
        setTimeout(() => router.refresh(), 400);
      }}
    >
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}

export function DeleteEmployee({ id }: { id: number }) {
  return (
    <ConfirmSubmit
      action={`/api/admin/employees/${id}/delete`}
      message="Ta bort den anställda? Pass och tidsstämplar tas också bort."
    >
      Ta bort
    </ConfirmSubmit>
  );
}

export function DeleteShift({ id }: { id: number }) {
  return (
    <ConfirmSubmit action={`/api/admin/shifts/${id}/delete`} message="Ta bort passet ur schemat?">
      ✕
    </ConfirmSubmit>
  );
}
