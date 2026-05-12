import Spinner from './Spinner';

export default function Button({
  children, variant = 'primary', loading = false,
  className = '', disabled, ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    danger: 'btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };
  return (
    <button
      className={`${variants[variant] || variants.primary} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
