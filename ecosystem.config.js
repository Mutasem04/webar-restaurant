/**
 * PM2 Ecosystem Configuration
 * Production process management for WebAR Restaurant Platform
 * 
 * Usage:
 *   Start:   pm2 start ecosystem.config.js
 *   Reload:  pm2 reload ecosystem.config.js
 *   Stop:    pm2 stop ecosystem.config.js
 *   Logs:    pm2 logs webar-restaurant
 *   Monitor: pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'webar-restaurant',
      script: 'server.js',
      
      // Instances
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable cluster mode
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      
      // Logging
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart policy
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 30000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Watch (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'database', '.git'],
      
      // Source maps for better error stacks
      source_map_support: true,
      
      // Auto-restart on file changes (development only)
      watch_delay: 1000,
      
      // Health monitoring
      exp_backoff_restart_delay: 100
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/webar-restaurant.git',
      path: '/var/www/webar-restaurant',
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production'
      }
    },
    staging: {
      user: 'deploy',
      host: ['staging.your-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/webar-restaurant.git',
      path: '/var/www/webar-restaurant-staging',
      'post-deploy': 'npm ci && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};
