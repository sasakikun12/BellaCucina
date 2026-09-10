import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../../src/components/StatusBadge";

describe("StatusBadge", () => {
  it("renderiza o rótulo com as classes de cor informadas", () => {
    render(<StatusBadge label="Pronto" colorClasses="bg-emerald-100 text-emerald-800" />);

    const badge = screen.getByText("Pronto");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-emerald-100");
  });
});
