# Cuenta, admin, bandeja de tipo API (simula WhatsApp), Agent Bot "Rocket" y un contacto de prueba.
# Idempotente. Lo corre ./setup.sh dentro del contenedor de Chatwoot.
account = Account.find_or_create_by!(name: 'Fluver (local)')

user = User.find_by(email: 'admin@rocket.test') ||
       User.create!(name: 'Admin local', email: 'admin@rocket.test', type: 'SuperAdmin',
                    password: ENV.fetch('ADMIN_PASSWORD'), password_confirmation: ENV.fetch('ADMIN_PASSWORD'))
user.update!(confirmed_at: Time.current)
AccountUser.find_or_create_by!(account: account, user: user) { |au| au.role = :administrator }

inbox = account.inboxes.find_by(name: 'WhatsApp (simulado)') ||
        account.inboxes.create!(name: 'WhatsApp (simulado)', channel: Channel::Api.create!(account: account))

bot = AgentBot.find_or_create_by!(name: 'Rocket', account: account) { |b| b.bot_type = :webhook }
bot.update!(outgoing_url: ENV.fetch('ROCKET_WEBHOOK_URL'), secret: ENV.fetch('BOT_SECRET'))
AgentBotInbox.find_or_create_by!(inbox: inbox, agent_bot: bot) do |abi|
  abi.account = account
  abi.status = :active
end

contact = account.contacts.find_by(phone_number: '+573000000001') ||
          account.contacts.create!(name: 'Cliente de prueba', phone_number: '+573000000001')
contact_inbox = ContactInbox.find_or_create_by!(contact: contact, inbox: inbox) { |ci| ci.source_id = SecureRandom.uuid }

puts({
  account_id: account.id,
  user_token: user.access_token.token,
  bot_token: bot.access_token.token,
  bot_secret: bot.secret,
  inbox_identifier: inbox.channel.identifier,
  contact_source_id: contact_inbox.source_id
}.to_json)
