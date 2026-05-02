import { NavLink } from 'react-router-dom'
import { Home, BarChart3, Users, User } from 'lucide-react'

const links = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/stats', icon: BarChart3, label: 'Stats' },
  { to: '/war-rooms', icon: Users, label: 'Squads' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function Nav() {
  return (
    <nav className="floating-nav">
      <div className="floating-nav__inner">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `floating-nav__link${isActive ? ' is-active' : ''}`
            }
          >
            <span className="floating-nav__icon">
              <Icon size={20} strokeWidth={1.9} />
            </span>
            <span className="floating-nav__label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
