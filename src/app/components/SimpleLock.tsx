'use client';

import HamburgerMenu from './HamburgerMenu';

export default function SimpleLock() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'white',
            margin: 0
          }}>Browse Mentors</h1>
          
          {/* Hamburger Menu */}
          <HamburgerMenu theme="dark" />
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          {/* Hero Section */}
          <section style={{
            textAlign: 'center',
            marginBottom: '40px'
          }}>
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: '600',
              color: 'white',
              marginBottom: '16px'
            }}>Magic Matching in Progress</h2>
            <p style={{
              fontSize: '1.1rem',
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: 1.6
            }}>
              We're fine-tuning our AI-powered mentor matching system to ensure you connect with the perfect mentor.
            </p>
          </section>

          {/* Main Card */}
          <div style={{
            display: 'flex',
            justifyContent: 'center'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              padding: '40px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              maxWidth: '600px',
              width: '100%',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '4rem',
                marginBottom: '20px'
              }}>🔒</div>
              
              <h3 style={{
                fontSize: '1.8rem',
                fontWeight: '600',
                color: '#2d3748',
                marginBottom: '16px'
              }}>Coming Soon!</h3>
              
              <p style={{
                fontSize: '1.1rem',
                color: '#4a5568',
                lineHeight: 1.6,
                marginBottom: '24px'
              }}>
                Our magic matching system is being fine-tuned to ensure you meet your perfect mentor. 
                This takes time to get right, but it'll be worth the wait!
              </p>

              {/* Feature List */}
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px 0',
                textAlign: 'left'
              }}>
                <li style={{
                  fontSize: '1rem',
                  color: '#4a5568',
                  lineHeight: 1.6,
                  marginBottom: '8px',
                  paddingLeft: '20px',
                  position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: '#667eea'
                  }}>•</span>
                  Our algorithm analyzes your goals and preferences
                </li>
                <li style={{
                  fontSize: '1rem',
                  color: '#4a5568',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  paddingLeft: '20px',
                  position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: '#667eea'
                  }}>•</span>
                  We ensure every mentor meets our high standards
                </li>
                <li style={{
                  fontSize: '1rem',
                  color: '#4a5568',
                  lineHeight: '1.6',
                  marginBottom: '8px',
                  paddingLeft: '20px',
                  position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    color: '#667eea'
                  }}>•</span>
                  Every connection will be meaningful and impactful
                </li>
              </ul>

              {/* Status */}
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#0ea5e9',
                    borderRadius: '50%'
                  }}></div>
                  <span style={{
                    color: '#0c4a6e',
                    fontWeight: '500',
                    fontSize: '0.875rem'
                  }}>System Status: Active Development</span>
                </div>
                <p style={{
                  color: '#0c4a6e',
                  fontSize: '0.875rem',
                  margin: 0,
                  textAlign: 'center'
                }}>
                  <strong>Stay tuned!</strong> We'll notify you via email as soon as the magic matching is ready.
                </p>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '16px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <a 
                  href="/dashboard" 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '12px 24px',
                    background: '#667eea',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '1rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLElement;
                    target.style.background = '#5a67d8';
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLElement;
                    target.style.background = '#667eea';
                  }}
                >
                  Back to Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
