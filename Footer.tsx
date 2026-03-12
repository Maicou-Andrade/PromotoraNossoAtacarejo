import { LOGO_URL } from "@/lib/constants";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <div className="container mx-auto py-3 px-4 flex items-center justify-center gap-2">
        <img
          src={LOGO_URL}
          alt="MS Consultoria"
          className="h-5 w-5 rounded object-cover opacity-60"
        />
        <p className="text-xs text-muted-foreground">
          &copy; {year} MS Consultoria. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
