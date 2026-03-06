import { Modal } from "../../../ui/Modal";
import "./KeyboardHelp.css";

const SECTIONS = [
  {
    title: "Playback",
    shortcuts: [
      { keys: ["Space"], desc: "Play / Pause" },
      { keys: ["←"], desc: "Previous frame" },
      { keys: ["→"], desc: "Next frame" },
    ],
  },
  {
    title: "Edit",
    shortcuts: [
      { keys: ["Ctrl", "Z"], desc: "Undo" },
      { keys: ["Ctrl", "Y"], desc: "Redo" },
      { keys: ["Ctrl", "Shift", "Z"], desc: "Redo (alternate)" },
    ],
  },
  {
    title: "Project",
    shortcuts: [{ keys: ["Ctrl", "S"], desc: "Save project" }],
  },
  {
    title: "Help",
    shortcuts: [{ keys: ["?"], desc: "Toggle this overlay" }],
  },
];

export function KeyboardHelp({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      width={460}
    >
      <div className="kb-help">
        {SECTIONS.map((section) => (
          <div key={section.title} className="kb-help__section">
            <h3 className="kb-help__section-title">{section.title}</h3>
            <ul className="kb-help__list">
              {section.shortcuts.map(({ keys, desc }) => (
                <li key={desc} className="kb-help__row">
                  <span className="kb-help__desc">{desc}</span>
                  <span className="kb-help__keys">
                    {keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="kb-help__key">{k}</kbd>
                        {i < keys.length - 1 && (
                          <span className="kb-help__plus">+</span>
                        )}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="kb-help__note">
          Shortcuts are disabled when a text input is focused.
        </p>
      </div>
    </Modal>
  );
}
