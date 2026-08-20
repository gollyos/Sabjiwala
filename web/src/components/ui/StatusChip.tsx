import { CheckCircle2, Clock, Layers, Truck, AlertTriangle, XCircle, Lock, PackageCheck } from 'lucide-react';
export type StatusType = 
  | 'new' 
  | 'draft' 
  | 'waiting' 
  | 'confirmed' 
  | 'assigned' 
  | 'packing' 
  | 'packed' 
  | 'ready' 
  | 'verified' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'completed' 
  | 'problem' 
  | 'failed' 
  | 'disputed' 
  | 'cancelled' 
  | 'locked'
  | 'active'
  | 'inactive';

interface StatusChipProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusChip({ status, label, size = 'md', className = '' }: StatusChipProps) {
  const normStatus = (status || '').toLowerCase().trim();

  let config = {
    bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    icon: Clock,
    text: label || status,
  };

  switch (normStatus) {
    case 'new':
    case 'draft':
    case 'waiting':
      config = {
        bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: Clock,
        text: label || 'Waiting / New',
      };
      break;
    case 'confirmed':
    case 'assigned':
      config = {
        bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/80',
        icon: CheckCircle2,
        text: label || 'Confirmed (કન્ફર્મ)',
      };
      break;
    case 'packing':
      config = {
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/80',
        icon: Layers,
        text: label || 'Packing (પેકિંગ)',
      };
      break;
    case 'packed':
    case 'ready':
    case 'verified':
      config = {
        bg: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/80',
        icon: PackageCheck,
        text: label || 'Ready (તૈયાર)',
      };
      break;
    case 'out_for_delivery':
      config = {
        bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/80',
        icon: Truck,
        text: label || 'Out for Delivery',
      };
      break;
    case 'delivered':
    case 'completed':
    case 'active':
      config = {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80',
        icon: CheckCircle2,
        text: label || 'Delivered (ડિલિવર્ડ)',
      };
      break;
    case 'problem':
    case 'failed':
    case 'disputed':
      config = {
        bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/80',
        icon: AlertTriangle,
        text: label || 'Problem (સમસ્યા)',
      };
      break;
    case 'cancelled':
    case 'inactive':
      config = {
        bg: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800',
        icon: XCircle,
        text: label || 'Cancelled',
      };
      break;
    case 'locked':
      config = {
        bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/80',
        icon: Lock,
        text: label || 'Locked (લૉક)',
      };
      break;
    default:
      config.text = label || status;
  }

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border shadow-2xs font-sans tracking-wide shrink-0 ${config.bg} ${sizeClasses[size]} ${className}`}
    >
      <IconComponent className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{config.text}</span>
    </span>
  );
}
