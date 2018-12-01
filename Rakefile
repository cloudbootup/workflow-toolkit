namespace :js do

end

flyway_version = "5.2.1"

namespace :flyway do

  desc "Flyway version"
  task :version do
    sh "echo #{flyway_version}"
  end

  desc "Check to see if flyway is installed"
  task :check do
    if !File.exists?("flyway-${flyway_version}")
      STDERR.puts "Flyway is not installed it seems. Run 'rake flyway:install' to install it"
      exit 1
    end
  end

  desc "Install flyway"
  task :install do
    unless File.exists?("flyway.tar.gz")
      sh "wget -O flyway.tar.gz https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/#{flyway_version}/flyway-commandline-#{flyway_version}-linux-x64.tar.gz"
    end
    sh "tar xf flyway.tar.gz"
  end

  desc "Run flyway migrations"
  task :migrate do
    sh "cp migrations/* flyway-#{flyway_version}/sql/"
    exec "./flyway-#{flyway_version}/flyway migrate"
  end

  desc "Drop tables"
  task :clean do
    sh "cp migrations/* flyway-#{flyway_version}/sql/"
    exec "./flyway-#{flyway_version}/flyway clean"
  end
end

namespace :setup do

  desc "Install all the prerequisites"
  task :initialize do
    sh "sudo apt update"
    sh "sudo apt install --yes software-properties-common"
    sh "curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -"
    sh <<-INSTALL
      sudo apt install --yes \
        nodejs ruby git libpq-dev postgresql \
        postgresql-client-common \
        build-essential gnupg2
    INSTALL
  end

end

namespace :postgres do

  user = 'workflow'
  password = 'workflow'
  db = 'workflow'

  desc "Initial configuration for postgres"
  task :configure do
    pg_dirs = Dir["/etc/postgresql/*"].sort.select { |d| File.directory?(d) }.sort.reverse
    if pg_dirs.length > 1
      error = "Found too many postgres directories. Script assumes exactly 1: #{pg_dirs.join(', ')}"
      raise StandardError, error
    end
    pg_dir = pg_dirs.first
    # First we need to modify the configuration to be able to log in
    sh "sudo cp postgresql/pg_hba.conf #{pg_dir}/main/"
    sh "sudo chown postgres:postgres #{pg_dir}/main/pg_hba.conf"
    sh "sudo service postgresql restart"
    # Now we can create the role/user and associated database
    sh "createuser -U postgres -d -e #{user} || true"
    sh "createdb -U #{user} #{db} || true"
    # Grant all privileges on that database to that user
    sh "psql -U postgres -c 'grant all privileges on database #{db} to #{user}'"
    # We gotta set a password otherwise flyway won't work
    sh "psql -U postgres -c \"alter user #{user} with password '#{password}'\""
    # Copy the flyway configuration and run the initial migrations
    sh "cp flyway/flyway.conf flyway-#{flyway_version}/conf/"
    sh "cp migrations/* flyway-#{flyway_version}/sql/"
    sh "./flyway-#{flyway_version}/flyway migrate"
  end

end

EXT = 'gpg' # Tacked on to the encrypted file
IGNORE_TRACKED = 'IGNORE_TRACKED' # Override error for tracked files
# Close stdout and stderr when invoking commands
REDIRECTION = {
  1 => STDOUT,
  2 => STDERR
}
# Commands for gpg/keybase encryption/decryption
{
  gpg: {
    encryption: ->(output, recipients, input) {
      ['gpg', '--yes', '--batch', '-e', '-a', '-o', output, *recipients, input]
    },
    decryption: ->(input, output) {
      ['gpg', '-d', '--batch', '--yes', '-o', output, input]
    },
    recipients: ->(recipients) { # We need to transform the recipient list for gpg
      recipients.flat_map {|r| ['-r', r]}
    }
  },
  keybase: {
    encryption: ->(output, recipients, input) {
      ['keybase', 'pgp', 'encrypt', '-i', input, '-o', output, *recipients]
    },
    decryption: ->(input, output) {
      ['keybase', 'pgp', 'decrypt', '-i', input, '-o', output]
    },
    recipients: ->(input) { input } # No transformation necessary for keybase
  }
}.each do |name, options| # Iterate and generate the tasks
  namespace name do
  
    desc "Encrypt a file with the given #{name} recipients: rake #{name}:encrypt[<file>,<recipient 1>,...,<recipient n>]"
    task :encrypt, [:file, :'recipients...'] do |t, args|
      input_file, recipients = args[:file], options[:recipients][args.to_a[1..-1]]
      if input_file.nil?
        raise StandardError, "Must provide input file"
      end
      unless File.exists?(input_file)
        raise StandardError, "Can not encrypt non-existent file: #{input_file}"
      end
      unless recipients.any?
        raise StandardError, "Must provide at least 1 recipient"
      end
      check_ignore_command = [
        'git', 'check-ignore', '--no-index', '-q', input_file
      ]
      unless system(*check_ignore_command, REDIRECTION)
        raise StandardError, "Refusing to encrypt file that is not ignored by git: #{input_file}"
      end
      check_history_command = [
        'git', 'ls-files', input_file, '--error-unmatch'
      ]
      if system(*check_history_command, REDIRECTION) && ENV[IGNORE_TRACKED].nil?
        message = [
          "Refusing to encrypt tracked file: #{input_file}.", 
          "To encrypt tracked file set '#{IGNORE_TRACKED}' environment variable"
        ].join(' ')
        raise StandardError, message
      end
      output_file = "#{input_file}.#{EXT}"
      encrypt_command = options[:encryption][output_file, recipients, input_file]
      unless system(*encrypt_command, REDIRECTION)
        raise StandardError, "Unable to encrypt file: #{encrypt_command}"
      end
      STDOUT.puts "Encrypted file: #{output_file}"
    end
  
    desc "Decrypt a file(s): rake #{name}:decrypt[<file 1>,...,<file n>]"
    task :decrypt, [:'files...'] do |t, args|
      files = Set.new(args.to_a).map {|f| f =~ /\.#{EXT}$/ ? f : "#{f}.#{EXT}"}
      files.each do |input_file|
        unless File.exists?(input_file)
          raise StandardError, "Can not decrypt non-existent file: #{input_file}"
        end
        output_file = input_file.sub(/\.#{EXT}$/, '')
        decrypt_command = options[:decryption][input_file, output_file]
        unless system(*decrypt_command, REDIRECTION)
          raise StandardError, "Unable to decrypt file (#{input_file}): #{decrypt_command}"
        end
        STDOUT.puts "Decrypted file: #{output_file}"
      end
    end
  
  end # namespace
  
end # each
