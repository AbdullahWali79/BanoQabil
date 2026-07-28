import { Link } from 'react-router';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
  to?: string;
  className?: string;
  imgClassName?: string;
  showText?: boolean;
  textClassName?: string;
};

export function BrandLogo({
  to = '/',
  className,
  imgClassName,
  showText = true,
  textClassName,
}: BrandLogoProps) {
  const content = (
    <>
      <img
        src="/banoqabil_logo.png"
        alt="BanoQabil"
        className={cn('h-9 w-auto object-contain', imgClassName)}
      />
      {showText ? (
        <span className={cn('text-xl font-bold tracking-tight', textClassName)}>
          BanoQabil
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn('flex items-center gap-2.5', className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn('flex items-center gap-2.5', className)}>{content}</div>;
}
