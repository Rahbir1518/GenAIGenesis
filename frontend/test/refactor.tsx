// No imports, purely structural TS for a Dashboard Refactor

/**
 * Interface defining the structure of a Dashboard Widget.
 * Replacing legacy 'float' classes with numeric grid spans.
 */
interface IDashboardWidget {
  id: string;
  title: string;
  content: string | HTMLElement;
  // desktopSpan defines how many columns of the 12-column grid to occupy
  desktopSpan: 1 | 2 | 3 | 4 | 6 | 12; 
  priority: 'low' | 'high';
}

/**
 * Dashboard Props to handle the 15% bundle reduction 
 * by avoiding heavy CSS frameworks.
 */
interface DashboardProps {
  widgets: IDashboardWidget[];
  isMobile: boolean;
  theme: 'light' | 'dark';
}

const DashboardRefactor: React.FC<DashboardProps> = ({ widgets, isMobile, theme }) => {
  
  // Define Grid Container Logic
  // CSS Grid allows us to handle 'gap' without negative margin hacks
  const containerStyles: Record<string, string> = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)',
    gap: '1.5rem',
    padding: '2rem',
    backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
    transition: 'all 0.3s ease-in-out'
  };

  /**
   * Helper function to calculate grid placement.
   * Replaces legacy Bootstrap .col-md-X classes.
   */
  const getWidgetStyles = (widget: IDashboardWidget): Record<string, string> => {
    return {
      gridColumn: isMobile ? 'span 1' : `span ${widget.desktopSpan}`,
      minHeight: '200px',
      background: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    };
  };

  return (
    <section className="dashboard-container" style={containerStyles}>
      {widgets.map((widget) => (
        <article 
          key={widget.id} 
          style={getWidgetStyles(widget)}
          aria-label={`Dashboard widget: ${widget.title}`}
        >
          <header style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{widget.title}</h3>
          </header>
          
          <div className="widget-content" style={{ flex: 1, padding: '1rem' }}>
            {/* Widget internal content goes here */}
            {typeof widget.content === 'string' ? <p>{widget.content}</p> : widget.content}
          </div>
        </article>
      ))}
    </section>
  );
};