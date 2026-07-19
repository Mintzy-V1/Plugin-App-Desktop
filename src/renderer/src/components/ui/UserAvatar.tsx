interface UserAvatarProps {
  name: string;
  size?: 'md' | 'lg' | 'xl';
}

export default function UserAvatar({ name, size = 'md' }: UserAvatarProps) {
  const dimension = size === 'xl' ? 'h-24 w-24' : size === 'lg' ? 'h-16 w-16' : 'h-10 w-10';
  const textSize = size === 'xl' ? 'text-2xl' : size === 'lg' ? 'text-lg' : 'text-sm';

  return (
    <div className={`${dimension} flex items-center justify-center rounded-full bg-gradient-to-br from-[#0B4195] to-[#126DFB] font-bold text-white shrink-0`}>
      <span className={textSize}>{name?.trim()?.charAt(0)?.toUpperCase() || 'U'}</span>
    </div>
  );
}
