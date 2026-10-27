import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  ExclamationTriangle, 
  Info, 
  X 
} from 'react-bootstrap-icons';
import { useToast } from '../../contexts/ToastContext';
import './Toast.css';

const toastIcons = {
  success: <CheckCircle />,
  error: <XCircle />,
  warning: <ExclamationTriangle />,
  info: <Info />,
};

const toastVariants = {
  initial: { 
    opacity: 0, 
    y: -30,
    scale: 0.9,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 28
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    scale: 0.9,
    transition: {
      duration: 0.2
    }
  }
};

const Toast = ({ id, message, type, onClose }) => {
  return (
    <motion.div
      className={`toast-notification toast-${type}`}
      variants={toastVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <div className="toast-icon">
        {toastIcons[type]}
      </div>
      <div className="toast-message">{message}</div>
      <button 
        className="toast-close" 
        onClick={() => onClose(id)}
        aria-label="Close notification"
      >
        <X />
      </button>
    </motion.div>
  );
};

const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="toast-container">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={removeToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
