type TimeLabelProps = {
  label: string;
};

export default function TimeLabel({ label }: TimeLabelProps) {
  return (
    <div className="mt-5 flex justify-center">
      <span className="rounded-full bg-gray-7/60 px-2.5 py-1 text-[11px] text-text-tertiary backdrop-blur-sm">
        {label}
      </span>
    </div>
  );
}
