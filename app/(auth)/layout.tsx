import { LegalFooter } from '@/components/LegalFooter';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-lg font-semibold text-slate-100 tracking-tight leading-none">
              kanbanly
            </h1>
            <p className="text-[11px] text-slate-500 mt-1">
              Flow first. Build fast.
            </p>
          </div>
          {children}
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
