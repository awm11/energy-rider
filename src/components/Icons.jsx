const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const I = (paths) =>
  function Icon(props) {
    return (
      <svg {...base} {...props}>
        {paths}
      </svg>
    );
  };

export const PencilIcon = I(
  <>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
    <path d="M14.5 6.5l3 3" />
  </>,
);
export const LineIcon = I(
  <>
    <path d="M5 19L19 5" />
    <circle cx="5" cy="19" r="1.8" fill="currentColor" />
    <circle cx="19" cy="5" r="1.8" fill="currentColor" />
  </>,
);
export const EraserIcon = I(
  <>
    <path d="M8.5 19.5L3.8 14.8a2 2 0 010-2.8l8.5-8.5a2 2 0 012.8 0l4.7 4.7a2 2 0 010 2.8l-8.3 8.5z" />
    <path d="M8.5 19.5H20" />
    <path d="M9 8.5l6.5 6.5" />
  </>,
);
export const HandIcon = I(
  <>
    <path d="M8 13V5.5a1.5 1.5 0 013 0V12" />
    <path d="M11 11.5V4a1.5 1.5 0 013 0v7.5" />
    <path d="M14 11.5V5.5a1.5 1.5 0 013 0V14" />
    <path d="M17 9.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.6a6 6 0 01-4.6-2.2L4.4 14.6a1.6 1.6 0 012.4-2.1L8 13.8" />
  </>,
);
export const StartIcon = I(
  <>
    <path d="M3 17h13c1.7 0 3-1.3 3-3" />
    <path d="M4 17v-3h11v3" />
    <circle cx="9" cy="6.5" r="2.3" />
    <path d="M9 9v5" />
    <path d="M9 11l4 1.5" />
    <path d="M20 4v4M18 6h4" />
  </>,
);
export const PlayIcon = I(<path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" />);
export const PauseIcon = I(
  <>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
  </>,
);
export const StopIcon = I(<rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="currentColor" />);
export const FlagIcon = I(
  <>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2.5 4L16 12H5" fill="currentColor" fillOpacity="0.15" />
  </>,
);
export const MenuIcon = I(
  <>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </>,
);
export const UndoIcon = I(
  <>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </>,
);
export const RedoIcon = I(
  <>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
  </>,
);
export const ChartIcon = I(
  <>
    <path d="M4 4v16h16" />
    <path d="M7 15l4-5 3 3 5-7" />
  </>,
);
export const TableIcon = I(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
  </>,
);
export const PlusIcon = I(<path d="M12 5v14M5 12h14" />);
export const MinusIcon = I(<path d="M5 12h14" />);
export const ZoomInIcon = I(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6" />
  </>,
);
export const ZoomOutIcon = I(
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L20 20M7.5 10.5h6" />
  </>,
);
export const MusicIcon = I(
  <>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </>,
);
export const VideoIcon = I(
  <>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10.5l5-3v9l-5-3" />
  </>,
);
export const DownloadIcon = I(
  <>
    <path d="M12 4v11M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </>,
);
export const UploadIcon = I(
  <>
    <path d="M12 16V5M7 10l5-5 5 5" />
    <path d="M5 20h14" />
  </>,
);
export const HelpIcon = I(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </>,
);
export const FileIcon = I(
  <>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5" />
  </>,
);
export const FitIcon = I(
  <>
    <path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4" />
  </>,
);
export const CloseIcon = I(<path d="M6 6l12 12M18 6L6 18" />);
export const RecordIcon = I(
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.2" fill="currentColor" />
  </>,
);
export const SettingsIcon = I(
  <>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </>,
);
export const StepBackIcon = I(
  <>
    <path d="M17 5L9 12l8 7V5z" fill="currentColor" />
    <path d="M6 5v14" />
  </>,
);
export const StepFwdIcon = I(
  <>
    <path d="M7 5l8 7-8 7V5z" fill="currentColor" />
    <path d="M18 5v14" />
  </>,
);
export const RewindIcon = I(
  <>
    <path d="M11 6L4 12l7 6V6zM20 6l-7 6 7 6V6z" fill="currentColor" />
  </>,
);
export const ResumeIcon = I(
  <>
    <path d="M4 5v14l10-7L4 5z" fill="currentColor" />
    <rect x="15.5" y="5" width="3" height="14" rx="1" fill="currentColor" />
  </>,
);
export const BobIcon = I(
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </>,
);
