import { ReactNode } from 'react';

function OutcomeIcon({ children }: { children: ReactNode }) {
  return (
    <div className='mb-2 flex size-11 items-center justify-center rounded-full bg-muted text-foreground'>
      {children}
    </div>
  );
}

OutcomeIcon.displayName = 'OutcomeIcon';

export default OutcomeIcon;
