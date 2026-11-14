import type { ReactNode } from 'react';

type Props = {
  title: string;
  text: string;
  action?: ReactNode;
};

export const StateScreen = ({ title, text, action }: Props) => (
  <div className='flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center'>
    <h2 className='text-lg font-semibold'>{title}</h2>
    <p className='max-w-md text-sm text-muted-foreground'>{text}</p>
    {action}
  </div>
);
