interface LogoProps {
  className?: string;
}

export function Logo({ className = 'h-7 w-auto' }: LogoProps) {
  return (
    <>
      <img src="/logo.png" alt="Nexfin" className={`${className} dark:hidden`} />
      <img src="/logo-dark.png" alt="Nexfin" className={`${className} hidden dark:block`} />
    </>
  );
}
