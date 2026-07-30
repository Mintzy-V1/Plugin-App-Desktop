interface UserAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE = {
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-lg' },
  xl: { box: 'h-24 w-24', text: 'text-2xl' },
} as const;

export default function UserAvatar({ name, size = 'md' }: UserAvatarProps) {
  const { box, text } = SIZE[size];

  return (
    <div className={`${box} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-500 font-bold text-white`}>
      <span className={text}>{name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</span>
    </div>
  );
}
