require("dotenv").config();
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  if (
    typeof warning === "string" &&
    warning.includes('Supplying "ephemeral" for interaction response options is deprecated')
  ) {
    return;
  }
  return originalEmitWarning(warning, ...args);
};
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const BRAND_NAME = "Verdant External";
const ACCENT = 0x4e5dff;
const STATE_PATH = path.join(__dirname, ".bot-state.json");

const ID_DEFAULTS = {
  clientUpdate: "1372447369177731162",
  clientStatus: "1498302760817262692",
  requestConfig: "1498306235370442852",
  claimOrder: "1498305413831987333",
  ourClient: "1371107462286934156",
  founderRole: "1370777766949159092",
  supportCategory: "1498299126004056115",
  archiveCategory: "1498299229947432980",
  ticketsCategory: "1498299302555160709",
  applicationStatus: "1498299982917140623",
  applicationPanel: "1498300007734841426",
  ticketReceipt: "1498299366790926476",
  logs: "1498299403352408084",
  customerRole: "1498315122660343938",
};

const IDS = {
  clientUpdate: process.env.CLIENT_UPDATE_CHANNEL_ID ?? ID_DEFAULTS.clientUpdate,
  clientStatus: process.env.CLIENT_STATUS_CHANNEL_ID ?? ID_DEFAULTS.clientStatus,
  requestConfig: process.env.REQUEST_CONFIG_CHANNEL_ID ?? ID_DEFAULTS.requestConfig,
  claimOrder: process.env.CLAIM_ORDER_CHANNEL_ID ?? ID_DEFAULTS.claimOrder,
  ourClient: process.env.OUR_CLIENT_CHANNEL_ID ?? ID_DEFAULTS.ourClient,
  founderRole: process.env.FOUNDER_ROLE_ID ?? ID_DEFAULTS.founderRole,
  supportCategory: process.env.SUPPORT_CATEGORY_ID ?? ID_DEFAULTS.supportCategory,
  archiveCategory: process.env.ARCHIVE_CATEGORY_ID ?? ID_DEFAULTS.archiveCategory,
  ticketsCategory: process.env.TICKETS_CATEGORY_ID ?? ID_DEFAULTS.ticketsCategory,
  applicationStatus:
    process.env.APPLICATION_STATUS_CHANNEL_ID ?? ID_DEFAULTS.applicationStatus,
  applicationPanel:
    process.env.APPLICATION_PANEL_CHANNEL_ID ?? ID_DEFAULTS.applicationPanel,
  ticketReceipt: process.env.TICKET_RECEIPT_CHANNEL_ID ?? ID_DEFAULTS.ticketReceipt,
  logs: process.env.LOGS_CHANNEL_ID ?? ID_DEFAULTS.logs,
  customerRole: process.env.CUSTOMER_ROLE_ID ?? ID_DEFAULTS.customerRole,
};

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ORDERS_TABLE = process.env.SUPABASE_ORDERS_TABLE ?? "orders";
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const TICKET_OPTIONS = [
  { label: "Support", value: "support" },
  { label: "Claim Product", value: "claim_product" },
  { label: "HWID Reset", value: "hwid_reset" },
  { label: "License Freeze", value: "license_freeze" },
  { label: "License Unfreeze", value: "license_unfreeze" },
];

const PRODUCT_STATUS = [
  { name: "Fortnite Private", region: "Global", uptime90d: 98.53, operational: true },
  { name: "Apex Legends", region: "Global", uptime90d: 98.57, operational: true },
  { name: "Roblox", region: "Global", uptime90d: 98.72, operational: true },
  { name: "CS2", region: "Global", uptime90d: 98.44, operational: true },
  { name: "Forza Horizon 5", region: "Global", uptime90d: 98.5, operational: true },
];

const EXTERNAL_SERVICES = [
  { name: "GitHub", operational: true },
  { name: "Cloudflare", operational: true },
  { name: "Discord API", operational: true },
];

const state = loadState();

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
      if (!parsed.runtime) parsed.runtime = {};
      if (typeof parsed.runtime.online !== "boolean") parsed.runtime.online = true;
      if (!parsed.runtime.since || parsed.runtime.since < 1) {
        parsed.runtime.since = Date.now();
      }
      if (!parsed.panels || typeof parsed.panels !== "object") parsed.panels = {};
      if (!parsed.keys || typeof parsed.keys !== "object") parsed.keys = {};
      if (!parsed.stock || typeof parsed.stock !== "object") parsed.stock = {};
      if (!parsed.settings || typeof parsed.settings !== "object") parsed.settings = {};
      if (!parsed.warnings || typeof parsed.warnings !== "object") parsed.warnings = {};
      if (!parsed.claims || typeof parsed.claims !== "object") parsed.claims = {};
      if (!Array.isArray(parsed.requests)) parsed.requests = [];
      if (!parsed.promos || typeof parsed.promos !== "object") parsed.promos = {};
      if (!parsed.giftCards || typeof parsed.giftCards !== "object") parsed.giftCards = {};
      return parsed;
    }
  } catch (error) {
    console.error("Could not load state file:", error.message);
  }
  return {
    runtime: { online: true, since: Date.now() },
    panels: {},
    keys: {},
    stock: {},
    settings: {},
    warnings: {},
    claims: {},
    requests: [],
    promos: {},
    giftCards: {},
  };
}

function saveState() {
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getId(name) {
  return IDS[name];
}

function sanitizeName(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function userHasFounderRole(member) {
  return member.roles.cache.has(getId("founderRole"));
}

function canManage(member) {
  return (
    userHasFounderRole(member) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

function hasModPerm(member) {
  return (
    canManage(member) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    member.permissions.has(PermissionFlagsBits.KickMembers) ||
    member.permissions.has(PermissionFlagsBits.BanMembers) ||
    member.permissions.has(PermissionFlagsBits.ManageMessages)
  );
}

function asEphemeral(payload = {}) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

function toProductCode(product) {
  const p = product.trim().toLowerCase();
  if (p.includes("fort")) return "FN";
  if (p.includes("apex") || p.includes("r5apex") || p.includes("legends")) return "APX";
  if (p.includes("roblox") || p.includes("rblx")) return "RBLX";
  if (p.includes("cs2") || p.includes("counter")) return "CS2";
  if (p.includes("forza") || p.includes("fh5") || p.includes("horizon 5")) return "FH5";
  if (p.includes("all products")) return "ALL";
  return "GEN";
}

function randomKeyFragment(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function normalizeProductKey(product, keyRaw = "") {
  const code = toProductCode(product);
  const prefix = `${code}-VRDNT-`;
  const key = keyRaw.trim().toUpperCase();
  if (key.startsWith(prefix)) return key;
  const suffix = key ? key.replace(/[^A-Z0-9]/g, "").slice(0, 20) : randomKeyFragment();
  return `${prefix}${suffix || randomKeyFragment()}`;
}

function normalizePromoCode(code = "") {
  return code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

function generateCode(prefix = "VERDANT", size = 8) {
  return `${prefix}-${randomKeyFragment(size)}`;
}

async function createPromoCodeRecord({ code, type, value, createdBy }) {
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) throw new Error("Invalid code");
  if (supabase) {
    const { error } = await supabase.from("promo_codes").insert({
      code: normalizedCode,
      type,
      value,
      active: true,
    });
    if (error) throw error;
  }
  state.promos[normalizedCode] = {
    code: normalizedCode,
    type,
    value,
    active: true,
    createdBy,
    createdAt: Date.now(),
  };
  saveState();
  return normalizedCode;
}

async function createGiftCardRecord({ code, product, amountUsd, createdBy }) {
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) throw new Error("Invalid code");
  if (supabase) {
    const { error } = await supabase.from("gift_cards").insert({
      code: normalizedCode,
      product_hint: product,
      amount_usd: amountUsd,
      active: true,
      redeemed: false,
    });
    if (error) throw error;
  }
  state.giftCards[normalizedCode] = {
    code: normalizedCode,
    product,
    amountUsd,
    active: true,
    redeemed: false,
    createdBy,
    createdAt: Date.now(),
  };
  saveState();
  return normalizedCode;
}

async function sendCodeDm(user, text) {
  try {
    await user.send(text);
    return true;
  } catch {
    return false;
  }
}

async function findOrderByLicenseKey(licenseKeyRaw) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const licenseKey = licenseKeyRaw.trim().toUpperCase();
  const { data, error } = await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .select("*")
    .eq("license_key", licenseKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateOrderById(orderPkId, patch) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .update(patch)
    .eq("id", orderPkId);
  if (error) throw error;
}

async function verifyOrderClaim({ orderId, email, username }) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUser = username.trim().toLowerCase();
  const normalizedOrderId = orderId.trim();

  const { data, error } = await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .select("*")
    .eq("order_id", normalizedOrderId)
    .eq("email", normalizedEmail)
    .eq("username", normalizedUser)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data;
}

async function markOrderClaimed(orderId, discordUserId) {
  if (!supabase) return;
  const updatePayload = {
    claimed_discord_id: discordUserId,
    claimed_at: new Date().toISOString(),
  };
  const roleId = getId("customerRole");
  if (roleId) {
    updatePayload.claimed_role_id = roleId;
  }

  await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .update(updatePayload)
    .eq("order_id", orderId);
}

async function findClaimedOrderByDiscordId(discordUserId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(SUPABASE_ORDERS_TABLE)
    .select("*")
    .eq("claimed_discord_id", discordUserId)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function ensureCustomerRole(guild, discordUserId) {
  const member = await guild.members.fetch(discordUserId).catch(() => null);
  if (!member) return false;
  await member.roles.add(getId("customerRole")).catch(() => null);
  return true;
}

async function ensurePrivateClaimRole(guild, discordUserId) {
  const member = await guild.members.fetch(discordUserId).catch(() => null);
  if (!member) return null;

  let roleId = state.settings.privateClaimRoleId;
  let role = roleId ? guild.roles.cache.get(roleId) : null;
  if (!role) {
    role = await guild.roles.create({
      name: "verified-claim",
      mentionable: false,
      hoist: false,
      reason: "Private role for verified claims",
    });
    state.settings.privateClaimRoleId = role.id;
    saveState();
  }
  await member.roles.add(role).catch(() => null);
  return role?.id ?? null;
}

function formatUptime(startMs) {
  const total = Math.floor((Date.now() - startMs) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function calculateAverageUptime() {
  const total = PRODUCT_STATUS.reduce((sum, p) => sum + p.uptime90d, 0);
  return (total / PRODUCT_STATUS.length).toFixed(2);
}

function buildApplicationEmbed() {
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(`${BRAND_NAME} Application System`)
    .setDescription(
      "Apply to join Verdant External. Click the button below to open an application ticket."
    )
    .addFields(
      {
        name: "Requirements",
        value: [
          "- Be active in the community",
          "- Respect server rules",
          "- Provide valid details",
          "- Be available for feedback",
        ].join("\n"),
      },
      { name: "Note", value: "No duplicate panels are posted after restart." }
    );
}

function buildTicketRequestEmbed() {
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(`${BRAND_NAME} Ticket Request System`)
    .setDescription("Choose a ticket type from the dropdown below. A popup will ask for details.");
}

function buildTicketActionsGuideEmbed() {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("Claim / HWID / Freeze Actions")
    .setDescription(
      [
        "Use the same dropdown above for all request types:",
        "- Claim Product",
        "- HWID Reset",
        "- License Freeze",
        "- License Unfreeze",
        "",
        "Founder/Admin direct commands:",
        "`/hwid check`, `/hwid reset`, `/hwid freeze`, `/hwid unfreeze`",
      ].join("\n")
    );
}

function buildClaimOrderEmbed() {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("🔑 Claim Your Order")
    .setDescription(
      "After purchasing an account from our website, click the button below and include your Order ID."
    );
}

function buildApplicationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("apply_now")
      .setLabel("Apply Now")
      .setStyle(ButtonStyle.Primary)
  );
}

function buildTicketTypeRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_action")
      .setPlaceholder("Select ticket type")
      .addOptions(TICKET_OPTIONS)
  );
}

function buildClaimOrderRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("claim_order_open_modal")
      .setLabel("Claim Order")
      .setStyle(ButtonStyle.Success)
  );
}

function buildSystemStatusEmbed() {
  const operationalProducts = PRODUCT_STATUS.filter((p) => p.operational).length;
  const avgUptime = calculateAverageUptime();

  const productLines = PRODUCT_STATUS.map(
    (p) =>
      `## ${p.name}\nSupported in: ${p.region}\nStatus: ${
        p.operational ? "Operational" : "Degraded"
      }\n90-day uptime: ${p.uptime90d.toFixed(2)}%`
  ).join("\n\n");

  const externalLines = EXTERNAL_SERVICES.map(
    (s) => `- ${s.name}: ${s.operational ? "operational" : "degraded"}`
  ).join("\n");

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("Verdant System Status")
    .setDescription("System Status\nReal-time status of all products and services\n\nAll Systems Operational")
    .addFields(
      { name: "Products", value: productLines.slice(0, 1024) },
      { name: "External Services", value: externalLines },
      {
        name: "Overall System Health",
        value: `All services running smoothly\n\nProducts: ${PRODUCT_STATUS.length}\nOperational: ${operationalProducts}\nAvg Uptime: ${avgUptime}%`,
      }
    )
    .setFooter({ text: "Updated a few seconds ago" })
    .setTimestamp();
}

function buildClientFeaturesEmbed() {
  return new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle("Verdant Client Features (Coming Soon)")
    .setDescription(
      "Pre-release feature overview. Official release is coming soon."
    )
    .addFields(
      {
        name: "Compatibility",
        value: [
          "- Tournaments Optimized",
          "- Full Compatibility with Windows 10 & 11",
          "- Controller Supported",
          "- PlayStation Supported",
          "- Xbox Supported",
          "- Laptop Supported",
          "- GeForce NOW Supported",
          "- No Extra Hardware Required",
        ].join("\n"),
      },
      {
        name: "Feature List",
        value: [
          "- Discord RPC - Shows in-game status on Discord",
          "- Performance Mode - Disables all overlays",
          "- Streamer Mode - Hides visuals and menu at start",
          "- Laptop Mode - Enable laptop support",
        ].join("\n"),
      }
    )
    .setTimestamp();
}

function buildArchiveRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("archive_ticket")
      .setLabel("Archive Ticket")
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildStatusControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("set_status_online")
      .setLabel("Turn On")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("set_status_offline")
      .setLabel("Shut Down")
      .setStyle(ButtonStyle.Danger)
  );
}

async function resolveTicketParent(guild) {
  const configured = await guild.channels.fetch(getId("ticketsCategory"));
  if (configured?.type === ChannelType.GuildCategory) return configured.id;

  if (configured?.parentId) {
    const parent = await guild.channels.fetch(configured.parentId);
    if (parent?.type === ChannelType.GuildCategory) return parent.id;
  }

  const fallback = await guild.channels.fetch(getId("supportCategory"));
  if (fallback?.type === ChannelType.GuildCategory) return fallback.id;

  throw new Error("Invalid ticket parent. Use category ID for TICKETS_CATEGORY_ID.");
}

async function sendToLogChannel(guild, message) {
  const channel = await guild.channels.fetch(getId("logs"));
  if (channel?.type === ChannelType.GuildText) await channel.send({ content: message });
}

async function sendTransactionLog(guild, message) {
  const targetId = state.settings.transactionLogChannelId ?? getId("logs");
  const channel = await guild.channels.fetch(targetId).catch(() => null);
  if (channel?.type === ChannelType.GuildText) {
    await channel.send({ content: message });
  }
}

async function registerGuildCommands(guild) {
  const commands = [
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Show available commands"),
    new SlashCommandBuilder()
      .setName("test")
      .setDescription("Check if bot is online"),
    new SlashCommandBuilder()
      .setName("statuspage")
      .setDescription("Show current runtime status"),
    new SlashCommandBuilder()
      .setName("issuekey")
      .setDescription("Issue a product key (Admin only)")
      .addStringOption((o) =>
        o.setName("product").setDescription("Product name").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("key").setDescription("License key").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("issuekeyexpiry")
      .setDescription("Issue key with expiry in days (Admin only)")
      .addStringOption((o) =>
        o.setName("product").setDescription("Product name").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("key").setDescription("License key").setRequired(true)
      )
      .addIntegerOption((o) =>
        o.setName("days").setDescription("Days until expiration").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("disablekey")
      .setDescription("Disable a key (Admin only)")
      .addStringOption((o) =>
        o.setName("key").setDescription("License key").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("enablekey")
      .setDescription("Enable a key (Admin only)")
      .addStringOption((o) =>
        o.setName("key").setDescription("License key").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("getkeystate")
      .setDescription("Get state of a key")
      .addStringOption((o) =>
        o.setName("key").setDescription("License key").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("resendpanels")
      .setDescription("Re-send/update all system panels (Admin only)"),
    new SlashCommandBuilder()
      .setName("addstock")
      .setDescription("Add generated stock keys by amount (Admin only)")
      .addStringOption((o) =>
        o.setName("product").setDescription("Product name").setRequired(true)
      )
      .addIntegerOption((o) =>
        o.setName("amount").setDescription("How many keys to add").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("restock")
      .setDescription("Restock by amount or key list (Admin only)")
      .addStringOption((o) =>
        o.setName("product").setDescription("Product name").setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("keys")
          .setDescription("Comma-separated keys (optional)")
          .setRequired(false)
      )
      .addIntegerOption((o) =>
        o.setName("amount").setDescription("Generate this many keys (optional)").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("removestock")
      .setDescription("Remove stock by amount (Admin only)")
      .addStringOption((o) =>
        o.setName("product").setDescription("Product name").setRequired(true)
      )
      .addIntegerOption((o) =>
        o.setName("amount").setDescription("How many keys to remove").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("checkstock")
      .setDescription("Check available stock")
      .addStringOption((o) =>
        o.setName("product").setDescription("Product name").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("send")
      .setDescription("Send one key to a user (Admin only)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target user").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("product").setDescription("Product name").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("log")
      .setDescription("Set transaction log channel (Admin only)")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Text channel for transaction logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("setupcustomerrole")
      .setDescription("Set customer role assigned after delivery (Admin only)")
      .addRoleOption((o) =>
        o.setName("role").setDescription("Role to assign").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("promo")
      .setDescription("Manage promo codes (Admin only)")
      .addSubcommand((s) =>
        s
          .setName("create")
          .setDescription("Create promo with percent off")
          .addIntegerOption((o) =>
            o.setName("percent").setDescription("Percent off (1-100)").setRequired(true)
          )
          .addStringOption((o) =>
            o.setName("code").setDescription("Custom code (optional)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("send")
          .setDescription("Create and send promo to user")
          .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
          .addIntegerOption((o) =>
            o.setName("percent").setDescription("Percent off (1-100)").setRequired(true)
          )
          .addStringOption((o) =>
            o.setName("code").setDescription("Custom code (optional)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("give")
          .setDescription("Send existing promo code to user")
          .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
          .addStringOption((o) =>
            o.setName("code").setDescription("Existing promo code").setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("coupon")
      .setDescription("Manage coupons with fixed amount off (Admin only)")
      .addSubcommand((s) =>
        s
          .setName("create")
          .setDescription("Create coupon with fixed USD amount off")
          .addNumberOption((o) =>
            o.setName("amount").setDescription("Amount off in USD").setRequired(true)
          )
          .addStringOption((o) =>
            o.setName("code").setDescription("Custom code (optional)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("send")
          .setDescription("Create and send coupon to user")
          .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
          .addNumberOption((o) =>
            o.setName("amount").setDescription("Amount off in USD").setRequired(true)
          )
          .addStringOption((o) =>
            o.setName("code").setDescription("Custom code (optional)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("give")
          .setDescription("Send existing coupon code to user")
          .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
          .addStringOption((o) =>
            o.setName("code").setDescription("Existing coupon code").setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("giftcard")
      .setDescription("Manage gift cards (Admin only)")
      .addSubcommand((s) =>
        s
          .setName("create")
          .setDescription("Create gift card")
          .addStringOption((o) =>
            o.setName("product").setDescription("Product hint (Fortnite/Apex/Roblox/CS2)").setRequired(true)
          )
          .addNumberOption((o) =>
            o.setName("amount").setDescription("Gift card amount USD").setRequired(true)
          )
          .addStringOption((o) =>
            o.setName("code").setDescription("Custom code (optional)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("send")
          .setDescription("Create and send gift card to user")
          .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
          .addStringOption((o) =>
            o.setName("product").setDescription("Product hint (Fortnite/Apex/Roblox/CS2)").setRequired(true)
          )
          .addNumberOption((o) =>
            o.setName("amount").setDescription("Gift card amount USD").setRequired(true)
          )
          .addStringOption((o) =>
            o.setName("code").setDescription("Custom code (optional)").setRequired(false)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("give")
          .setDescription("Send existing gift card code to user")
          .addUserOption((o) => o.setName("user").setDescription("Target user").setRequired(true))
          .addStringOption((o) =>
            o.setName("code").setDescription("Existing gift card code").setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("hwid")
      .setDescription("Manage HWID / license lock (Admin only)")
      .addSubcommand((s) =>
        s
          .setName("reset")
          .setDescription("Reset HWID lock for a license")
          .addStringOption((o) =>
            o.setName("license").setDescription("License key").setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("check")
          .setDescription("Check HWID and license status")
          .addStringOption((o) =>
            o.setName("license").setDescription("License key").setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("freeze")
          .setDescription("Freeze a license (status = frozen)")
          .addStringOption((o) =>
            o.setName("license").setDescription("License key").setRequired(true)
          )
      )
      .addSubcommand((s) =>
        s
          .setName("unfreeze")
          .setDescription("Unfreeze a license (status = completed)")
          .addStringOption((o) =>
            o.setName("license").setDescription("License key").setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("claimapprove")
      .setDescription("Approve product claim for a Discord user (Admin only)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target Discord user").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("license").setDescription("License key from order").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a member (Moderator)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target member").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Reason").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("warnings")
      .setDescription("Show warnings for a member")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target member").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Timeout a member (Moderator)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target member").setRequired(true)
      )
      .addIntegerOption((o) =>
        o.setName("minutes").setDescription("Duration in minutes").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Reason").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("untimeout")
      .setDescription("Remove timeout from a member (Moderator)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target member").setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a member (Moderator)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target member").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Reason").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a member (Moderator)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Target member").setRequired(true)
      )
      .addStringOption((o) =>
        o.setName("reason").setDescription("Reason").setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("clear")
      .setDescription("Delete recent messages in current channel (Moderator)")
      .addIntegerOption((o) =>
        o
          .setName("amount")
          .setDescription("How many messages (1-100)")
          .setRequired(true)
      ),
  ];

  await guild.commands.set(commands.map((c) => c.toJSON()));
}

function findKeyRecord(key) {
  return state.keys[key] ?? null;
}

async function upsertPanelMessage(channel, stateKey, payload) {
  const knownMessageId = state.panels[stateKey];
  if (knownMessageId) {
    try {
      const existing = await channel.messages.fetch(knownMessageId);
      await existing.edit(payload);
      return existing;
    } catch {
      // Missing/deleted message - send a new one.
    }
  }

  const sent = await channel.send(payload);
  state.panels[stateKey] = sent.id;
  saveState();
  return sent;
}

async function upsertStatusMessage(guild) {
  const statusChannel = await guild.channels.fetch(getId("clientStatus"));
  if (!statusChannel || statusChannel.type !== ChannelType.GuildText) return;
  await upsertPanelMessage(statusChannel, "systemStatusClientPanel", {
    embeds: [buildSystemStatusEmbed()],
  });
}

async function postBootstrapPanels(guild) {
  const configChannel = await guild.channels.fetch(getId("requestConfig"));
  const claimOrderChannel = await guild.channels.fetch(getId("claimOrder"));
  const panelChannel = await guild.channels.fetch(getId("applicationPanel"));
  const appStatusChannel = await guild.channels.fetch(getId("applicationStatus"));
  const updateChannel = await guild.channels.fetch(getId("clientUpdate"));
  const ourClientChannel = await guild.channels.fetch(getId("ourClient"));

  if (configChannel?.type !== ChannelType.GuildText) {
    throw new Error("REQUEST_CONFIG_CHANNEL_ID must be a text channel.");
  }
  if (claimOrderChannel?.type !== ChannelType.GuildText) {
    throw new Error("CLAIM_ORDER_CHANNEL_ID must be a text channel.");
  }
  if (panelChannel?.type !== ChannelType.GuildText) {
    throw new Error("APPLICATION_PANEL_CHANNEL_ID must be a text channel.");
  }

  await upsertPanelMessage(configChannel, "ticketRequestPanel", {
    embeds: [buildTicketRequestEmbed()],
    components: [buildTicketTypeRow()],
  });
  await upsertPanelMessage(configChannel, "ticketActionGuidePanel", {
    embeds: [buildTicketActionsGuideEmbed()],
  });

  await upsertPanelMessage(claimOrderChannel, "claimOrderPanel", {
    embeds: [buildClaimOrderEmbed()],
    components: [buildClaimOrderRow()],
  });

  await upsertPanelMessage(panelChannel, "applicationPanel", {
    embeds: [buildApplicationEmbed()],
    components: [buildApplicationRow()],
  });

  if (appStatusChannel?.type === ChannelType.GuildText) {
    const embed = new EmbedBuilder()
      .setColor(ACCENT)
      .setTitle(`${BRAND_NAME} Runtime Controls`)
      .setDescription("Founder can toggle online/offline status.")
      .addFields({
        name: "Current",
        value: `${state.runtime.online ? "Online" : "Offline"} | Uptime: ${formatUptime(
          state.runtime.since
        )}`,
      });

    await upsertPanelMessage(appStatusChannel, "runtimeControlPanel", {
      embeds: [embed],
      components: [buildStatusControlRow()],
    });

    await upsertPanelMessage(appStatusChannel, "systemStatusPanel", {
      embeds: [buildSystemStatusEmbed()],
    });
  }

  // Remove old mirrored runtime-controls message from client-status, if present.
  const clientStatusChannel = await guild.channels.fetch(getId("clientStatus"));
  const oldRuntimeClientMessageId = state.panels.runtimeControlPanelClient;
  if (
    oldRuntimeClientMessageId &&
    clientStatusChannel?.type === ChannelType.GuildText
  ) {
    const oldMessage = await clientStatusChannel.messages
      .fetch(oldRuntimeClientMessageId)
      .catch(() => null);
    if (oldMessage) {
      await oldMessage.delete().catch(() => null);
    }
    delete state.panels.runtimeControlPanelClient;
    saveState();
  }

  if (updateChannel?.type === ChannelType.GuildText) {
    const embed = new EmbedBuilder()
      .setColor(ACCENT)
      .setTitle(`${BRAND_NAME} Client Update`)
      .setDescription("Bot is online. Verdant External release is coming soon.")
      .setTimestamp();
    await upsertPanelMessage(updateChannel, "clientUpdateMessage", { embeds: [embed] });
  }

  if (ourClientChannel?.type === ChannelType.GuildText) {
    await upsertPanelMessage(ourClientChannel, "ourClientFeaturesPanel", {
      embeds: [buildClientFeaturesEmbed()],
    });
  }

  await upsertStatusMessage(guild);
}

async function createTicket(interaction, typeLabel, details) {
  const guild = interaction.guild;
  if (!guild) return null;

  const parentId = await resolveTicketParent(guild);
  const baseName = sanitizeName(`${typeLabel}-${interaction.user.username}`);
  const channelName = `${baseName}-${interaction.user.id.slice(-4)}`.slice(0, 95);

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `${typeLabel} | User: ${interaction.user.id}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: getId("founderRole"),
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(`${BRAND_NAME} Ticket`)
    .setDescription("Staff will review your request shortly.")
    .addFields(
      { name: "Requester", value: `${interaction.user}`, inline: true },
      { name: "Type", value: typeLabel, inline: true },
      {
        name: "Details",
        value: details?.slice(0, 1024) ?? "No extra details provided.",
      }
    )
    .setTimestamp();

  await ticketChannel.send({
    content: `<@&${getId("founderRole")}>`,
    embeds: [embed],
    components: [buildArchiveRow()],
  });

  const statusChannel = await guild.channels.fetch(getId("applicationStatus"));
  if (statusChannel?.type === ChannelType.GuildText) {
    await statusChannel.send(`New ticket: ${ticketChannel} | ${typeLabel} | ${interaction.user}`);
  }

  await sendToLogChannel(
    guild,
    `[OPEN] ${typeLabel} | ${interaction.user.tag} (${interaction.user.id}) | #${ticketChannel.name}`
  );
  return ticketChannel;
}

async function archiveTicket(interaction) {
  if (!interaction.inCachedGuild()) return;
  if (!userHasFounderRole(interaction.member)) {
    await interaction.reply({
      content: "Only Founder/Owner can archive tickets.",
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.setParent(getId("archiveCategory"));
  await channel.setName(`archived-${channel.name}`.slice(0, 100));
  await interaction.reply({ content: "Ticket archived.", ephemeral: true });

  const receiptChannel = await interaction.guild.channels.fetch(getId("ticketReceipt"));
  if (receiptChannel?.type === ChannelType.GuildText) {
    const receipt = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("Ticket Archived")
      .addFields(
        { name: "Ticket", value: `#${channel.name}`, inline: true },
        { name: "Archived by", value: `${interaction.user}`, inline: true },
        { name: "Topic", value: channel.topic ?? "No topic set" }
      )
      .setTimestamp();
    await receiptChannel.send({ embeds: [receipt] });
  }

  await sendToLogChannel(
    interaction.guild,
    `[ARCHIVE] ${channel.name} by ${interaction.user.tag} (${interaction.user.id})`
  );
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    const guild = await client.guilds.fetch(getRequiredEnv("DISCORD_GUILD_ID"));
    await registerGuildCommands(guild);
    await postBootstrapPanels(guild);
    console.log("Panels and status are synced.");
  } catch (error) {
    console.error("Startup sync failed:", error.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!interaction.inCachedGuild()) return;
      const { commandName } = interaction;
      const member = interaction.member;
      const isFounder = userHasFounderRole(member);

      if (!isFounder) {
        await interaction.reply({
          content: "Only Founder can use bot commands.",
          ephemeral: true,
        });
        return;
      }

      if (commandName === "help") {
        await interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setColor(ACCENT)
              .setTitle(`${BRAND_NAME} Commands`)
              .setDescription(
                [
                  "`/help`, `/test`, `/statuspage`",
                  "`/issuekey`, `/issuekeyexpiry`, `/disablekey`, `/enablekey`, `/getkeystate`",
                  "`/addstock`, `/restock`, `/removestock`, `/checkstock`, `/send`",
                  "`/resendpanels`, `/log`, `/setupcustomerrole`, `/promo`, `/coupon`, `/giftcard`, `/hwid`, `/claimapprove`",
                  "`/warn`, `/warnings`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/clear`",
                ].join("\n")
              ),
          ],
        });
        return;
      }

      if (commandName === "test") {
        await interaction.reply({ content: "Bot is online.", ephemeral: true });
        return;
      }

      if (commandName === "statuspage") {
        await interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setColor(state.runtime.online ? 0x3ba55d : 0xed4245)
              .setTitle(`${BRAND_NAME} Status`)
              .addFields(
                {
                  name: "State",
                  value: state.runtime.online ? "Online" : "Offline",
                  inline: true,
                },
                {
                  name: "Uptime",
                  value: formatUptime(state.runtime.since),
                  inline: true,
                }
              ),
            buildSystemStatusEmbed(),
          ],
        });
        return;
      }

      if (commandName === "issuekey" || commandName === "issuekeyexpiry") {
        const product = interaction.options.getString("product", true).trim();
        const key = interaction.options.getString("key", true).trim();
        const expiresAt =
          commandName === "issuekeyexpiry"
            ? Date.now() + interaction.options.getInteger("days", true) * 86400000
            : null;
        state.keys[key] = {
          product,
          enabled: true,
          expiresAt,
          issuedAt: Date.now(),
          issuedBy: interaction.user.id,
          redeemedBy: null,
        };
        saveState();
        await interaction.reply({ content: `Key saved for **${product}**.`, ephemeral: true });
        return;
      }

      if (commandName === "resendpanels") {
        await interaction.deferReply({ ephemeral: true });
        await postBootstrapPanels(interaction.guild);
        await interaction.editReply("Panels re-sent and synced.");
        return;
      }

      if (commandName === "disablekey" || commandName === "enablekey") {
        const key = interaction.options.getString("key", true).trim();
        const rec = findKeyRecord(key);
        if (!rec) {
          await interaction.reply({ content: "Key not found.", ephemeral: true });
          return;
        }
        rec.enabled = commandName === "enablekey";
        saveState();
        await interaction.reply({
          content: `Key is now ${rec.enabled ? "enabled" : "disabled"}.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "getkeystate") {
        const key = interaction.options.getString("key", true).trim();
        const rec = findKeyRecord(key);
        if (!rec) {
          await interaction.reply({ content: "Key not found.", ephemeral: true });
          return;
        }
        const expired = rec.expiresAt ? Date.now() > rec.expiresAt : false;
        await interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setColor(ACCENT)
              .setTitle("Key State")
              .addFields(
                { name: "Product", value: rec.product, inline: true },
                { name: "Enabled", value: rec.enabled ? "Yes" : "No", inline: true },
                { name: "Expired", value: expired ? "Yes" : "No", inline: true },
                {
                  name: "Redeemed By",
                  value: rec.redeemedBy ? `<@${rec.redeemedBy}>` : "Not redeemed",
                }
              ),
          ],
        });
        return;
      }

      if (commandName === "addstock") {
        const product = interaction.options.getString("product", true).trim();
        const amount = Math.max(1, interaction.options.getInteger("amount", true));
        if (!state.stock[product]) state.stock[product] = [];
        const generated = [];
        for (let i = 0; i < amount; i += 1) {
          generated.push(normalizeProductKey(product, ""));
        }
        state.stock[product].push(...generated);
        saveState();
        await interaction.reply({
          content: `Added ${generated.length} generated keys to ${product}.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "restock") {
        const product = interaction.options.getString("product", true).trim();
        const keysRaw = interaction.options.getString("keys");
        const amount = interaction.options.getInteger("amount");
        const normalizedKeys = [];
        if (keysRaw) {
          const list = keysRaw
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
          normalizedKeys.push(...list.map((raw) => normalizeProductKey(product, raw)));
        }
        if (amount && amount > 0) {
          for (let i = 0; i < amount; i += 1) {
            normalizedKeys.push(normalizeProductKey(product, ""));
          }
        }
        if (!normalizedKeys.length) {
          await interaction.reply({
            content: "Provide `keys` or `amount`.",
            ephemeral: true,
          });
          return;
        }
        if (!state.stock[product]) state.stock[product] = [];
        state.stock[product].push(...normalizedKeys);
        saveState();
        await interaction.reply({
          content: `Added ${normalizedKeys.length} keys to ${product} with standardized format.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "removestock") {
        const product = interaction.options.getString("product", true).trim();
        const amount = Math.max(1, interaction.options.getInteger("amount", true));
        const pool = state.stock[product] ?? [];
        const removed = Math.min(amount, pool.length);
        if (removed > 0) {
          pool.splice(0, removed);
        }
        state.stock[product] = pool;
        saveState();
        await interaction.reply({
          content: removed
            ? `Removed ${removed} key(s) from ${product}.`
            : `No stock available for ${product}.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "checkstock") {
        const product = interaction.options.getString("product");
        if (product) {
          const count = (state.stock[product] ?? []).length;
          await interaction.reply({ content: `${product}: ${count} keys in stock.`, ephemeral: true });
          return;
        }
        const lines = Object.entries(state.stock).map(([name, arr]) => `- ${name}: ${arr.length}`);
        await interaction.reply({
          content: lines.length ? lines.join("\n") : "No stock configured.",
          ephemeral: true,
        });
        return;
      }

      if (commandName === "send") {
        const product = interaction.options.getString("product", true).trim();
        const user = interaction.options.getUser("user", true);
        const pool = state.stock[product] ?? [];
        if (!pool.length) {
          await interaction.reply({ content: `No stock available for ${product}.`, ephemeral: true });
          return;
        }
        const key = pool.shift();
        if (!state.keys[key]) {
          state.keys[key] = {
            product,
            enabled: true,
            expiresAt: null,
            issuedAt: Date.now(),
            issuedBy: interaction.user.id,
            redeemedBy: user.id,
          };
        } else {
          state.keys[key].redeemedBy = user.id;
        }
        saveState();

        try {
          await user.send(`Your ${BRAND_NAME} key for **${product}**: \`${key}\``);
        } catch {
          // DM failed; continue with admin feedback.
        }

        const customerRoleId = state.settings.customerRoleId;
        if (customerRoleId) {
          const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (guildMember) {
            await guildMember.roles.add(customerRoleId).catch(() => null);
          }
        }

        await sendTransactionLog(
          interaction.guild,
          `[DELIVERY] ${interaction.user.tag} sent ${product} key to ${user.tag}`
        );

        await interaction.reply({
          content: `Delivered 1 key for ${product} to ${user}.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "log") {
        const channel = interaction.options.getChannel("channel", true);
        state.settings.transactionLogChannelId = channel.id;
        saveState();
        await interaction.reply({
          content: `Transaction log channel set to ${channel}.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "setupcustomerrole") {
        const role = interaction.options.getRole("role", true);
        state.settings.customerRoleId = role.id;
        saveState();
        await interaction.reply({
          content: `Customer role set to <@&${role.id}>.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "promo" || commandName === "coupon") {
        const sub = interaction.options.getSubcommand(true);
        const isPercent = commandName === "promo";
        const type = isPercent ? "percent" : "fixed";
        const codeOption = interaction.options.getString("code");
        const code =
          normalizePromoCode(codeOption ?? "") ||
          generateCode(isPercent ? "PROMO" : "COUPON");
        const valueRaw = isPercent
          ? interaction.options.getInteger("percent")
          : interaction.options.getNumber("amount");
        const value = Number(valueRaw ?? 0);
        if (sub !== "give" && (!value || value <= 0 || (isPercent && value > 100))) {
          await interaction.reply({
            content: isPercent
              ? "Percent must be between 1 and 100."
              : "Amount must be greater than 0.",
            ephemeral: true,
          });
          return;
        }

        if (sub === "create" || sub === "send") {
          try {
            await createPromoCodeRecord({
              code,
              type,
              value,
              createdBy: interaction.user.id,
            });
          } catch (error) {
            await interaction.reply({
              content: `Failed to create code: ${error.message}`,
              ephemeral: true,
            });
            return;
          }
        }

        const finalCode =
          sub === "give"
            ? normalizePromoCode(interaction.options.getString("code", true))
            : code;
        const label =
          sub === "give"
            ? "existing code"
            : isPercent
              ? `${value}% OFF`
              : `$${value.toFixed(2)} OFF`;
        if (sub === "send" || sub === "give") {
          const user = interaction.options.getUser("user", true);
          const sent = await sendCodeDm(
            user,
            `${BRAND_NAME} ${isPercent ? "promo" : "coupon"} code: \`${finalCode}\` (${label})`
          );
          await interaction.reply({
            content: sent
              ? `Code \`${finalCode}\` sent to ${user}.`
              : `Code \`${finalCode}\` created, but DM to ${user} failed.`,
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: `${isPercent ? "Promo" : "Coupon"} created: \`${finalCode}\` (${label}).`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "giftcard") {
        const sub = interaction.options.getSubcommand(true);
        const codeOption = interaction.options.getString("code");
        const code = normalizePromoCode(codeOption ?? "") || generateCode("GIFT", 10);
        const amount = Number(interaction.options.getNumber("amount") ?? 0);
        if (sub !== "give" && amount <= 0) {
          await interaction.reply({
            content: "Gift card amount must be greater than 0.",
            ephemeral: true,
          });
          return;
        }

        if (sub === "create" || sub === "send") {
          const product = interaction.options.getString("product", true).trim();
          try {
            await createGiftCardRecord({
              code,
              product,
              amountUsd: amount,
              createdBy: interaction.user.id,
            });
          } catch (error) {
            await interaction.reply({
              content: `Failed to create gift card: ${error.message}`,
              ephemeral: true,
            });
            return;
          }
        }

        const finalCode =
          sub === "give"
            ? normalizePromoCode(interaction.options.getString("code", true))
            : code;
        const amountText = sub === "give" ? "custom amount" : `$${amount.toFixed(2)}`;
        if (sub === "send" || sub === "give") {
          const user = interaction.options.getUser("user", true);
          const sent = await sendCodeDm(
            user,
            `${BRAND_NAME} gift card code: \`${finalCode}\` (${amountText})`
          );
          await interaction.reply({
            content: sent
              ? `Gift card \`${finalCode}\` sent to ${user}.`
              : `Gift card \`${finalCode}\` created, but DM to ${user} failed.`,
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: `Gift card created: \`${finalCode}\` ($${amount.toFixed(2)}).`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "hwid") {
        const sub = interaction.options.getSubcommand(true);
        const license = interaction.options.getString("license", true).trim().toUpperCase();
        let order;
        try {
          order = await findOrderByLicenseKey(license);
        } catch (error) {
          await interaction.reply({
            content: `HWID operation failed: ${error.message}`,
            ephemeral: true,
          });
          return;
        }
        if (!order) {
          await interaction.reply({
            content: "License not found.",
            ephemeral: true,
          });
          return;
        }

        if (sub === "check") {
          await interaction.reply({
            ephemeral: true,
            embeds: [
              new EmbedBuilder()
                .setColor(ACCENT)
                .setTitle("HWID / License State")
                .addFields(
                  { name: "License", value: order.license_key ?? license },
                  { name: "Product", value: order.product ?? "Unknown", inline: true },
                  { name: "Status", value: order.status ?? "completed", inline: true },
                  {
                    name: "HWID Lock",
                    value: order.hwid_lock ? `\`${String(order.hwid_lock).slice(0, 18)}...\`` : "Not bound",
                  },
                  {
                    name: "Last Seen",
                    value: order.hwid_last_seen ? `<t:${Math.floor(new Date(order.hwid_last_seen).getTime() / 1000)}:R>` : "Never",
                    inline: true,
                  },
                  {
                    name: "Claimed Discord",
                    value: order.claimed_discord_id ? `<@${order.claimed_discord_id}>` : "Not claimed",
                    inline: true,
                  }
                ),
            ],
          });
          return;
        }

        if (sub === "reset") {
          await updateOrderById(order.id, {
            hwid_lock: null,
            hwid_last_seen: null,
          });
          await interaction.reply({
            content: `HWID reset completed for \`${license}\`.`,
            ephemeral: true,
          });
          await sendToLogChannel(
            interaction.guild,
            `[HWID-RESET] ${interaction.user.tag} reset ${license}`
          );
          return;
        }

        if (sub === "freeze" || sub === "unfreeze") {
          const nextStatus = sub === "freeze" ? "frozen" : "completed";
          await updateOrderById(order.id, { status: nextStatus });
          await interaction.reply({
            content: `License \`${license}\` is now **${nextStatus}**.`,
            ephemeral: true,
          });
          await sendToLogChannel(
            interaction.guild,
            `[LICENSE-${sub.toUpperCase()}] ${interaction.user.tag} set ${license} => ${nextStatus}`
          );
          return;
        }
      }

      if (commandName === "claimapprove") {
        const user = interaction.options.getUser("user", true);
        const license = interaction.options.getString("license", true).trim().toUpperCase();
        let order;
        try {
          order = await findOrderByLicenseKey(license);
        } catch (error) {
          await interaction.reply({
            content: `Claim approve failed: ${error.message}`,
            ephemeral: true,
          });
          return;
        }
        if (!order) {
          await interaction.reply({ content: "License not found.", ephemeral: true });
          return;
        }

        await updateOrderById(order.id, {
          claimed_discord_id: user.id,
          claimed_at: new Date().toISOString(),
          claimed_role_id: getId("customerRole"),
        });

        state.claims[user.id] = {
          orderId: order.order_id,
          product: order.product,
          email: order.email,
          username: order.username,
          claimedAt: Date.now(),
          approvedBy: interaction.user.id,
        };
        saveState();

        const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (guildMember && getId("customerRole")) {
          await guildMember.roles.add(getId("customerRole")).catch(() => null);
        }

        let delivered = false;
        let deliveredKey = null;
        const pool = state.stock[order.product] ?? [];
        if (pool.length > 0) {
          deliveredKey = pool.shift();
          saveState();
          try {
            await user.send(
              `Your ${BRAND_NAME} product key for **${order.product}**: \`${deliveredKey}\``
            );
            delivered = true;
          } catch {
            delivered = false;
          }
          await sendTransactionLog(
            interaction.guild,
            `[DELIVERY-APPROVE] ${interaction.user.tag} delivered ${order.product} key to ${user.tag}`
          );
        }

        await interaction.reply({
          content: delivered
            ? `Claim approved for ${user}. Product: **${order.product}**. Key delivered in DM.`
            : `Claim approved for ${user}. Product: **${order.product}**. ${
                deliveredKey
                  ? "DM failed, but key was assigned."
                  : "No stock available yet, but claim is active."
              }`,
        });
        await sendToLogChannel(
          interaction.guild,
          `[CLAIM-APPROVE] ${interaction.user.tag} approved ${user.tag} for ${order.product} (${license})`
        );
        return;
      }

      if (commandName === "warn") {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true).trim();
        if (!state.warnings[user.id]) state.warnings[user.id] = [];
        state.warnings[user.id].push({
          reason,
          moderatorId: interaction.user.id,
          createdAt: Date.now(),
        });
        saveState();
        await sendToLogChannel(
          interaction.guild,
          `[WARN] ${user.tag} warned by ${interaction.user.tag}: ${reason}`
        );
        await interaction.reply({
          content: `${user} has been warned.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "warnings") {
        const user = interaction.options.getUser("user", true);
        const warnings = state.warnings[user.id] ?? [];
        if (!warnings.length) {
          await interaction.reply({
            content: `${user} has no warnings.`,
            ephemeral: true,
          });
          return;
        }
        const lines = warnings
          .slice(-10)
          .map(
            (w, idx) =>
              `${idx + 1}. ${w.reason} (by <@${w.moderatorId}> <t:${Math.floor(
                w.createdAt / 1000
              )}:R>)`
          )
          .join("\n");
        await interaction.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setColor(ACCENT)
              .setTitle(`Warnings for ${user.tag}`)
              .setDescription(lines),
          ],
        });
        return;
      }

      if (commandName === "timeout") {
        const user = interaction.options.getUser("user", true);
        const minutes = interaction.options.getInteger("minutes", true);
        const reason = interaction.options.getString("reason") ?? "No reason";
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!target) {
          await interaction.reply({ content: "Member not found.", ephemeral: true });
          return;
        }
        await target.timeout(minutes * 60 * 1000, reason);
        await sendToLogChannel(
          interaction.guild,
          `[TIMEOUT] ${user.tag} for ${minutes}m by ${interaction.user.tag}: ${reason}`
        );
        await interaction.reply({
          content: `${user} timed out for ${minutes} minute(s).`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "untimeout") {
        const user = interaction.options.getUser("user", true);
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!target) {
          await interaction.reply({ content: "Member not found.", ephemeral: true });
          return;
        }
        await target.timeout(null);
        await sendToLogChannel(
          interaction.guild,
          `[UNTIMEOUT] ${user.tag} by ${interaction.user.tag}`
        );
        await interaction.reply({
          content: `${user} timeout removed.`,
          ephemeral: true,
        });
        return;
      }

      if (commandName === "kick") {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason";
        const target = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!target) {
          await interaction.reply({ content: "Member not found.", ephemeral: true });
          return;
        }
        await target.kick(reason);
        await sendToLogChannel(
          interaction.guild,
          `[KICK] ${user.tag} by ${interaction.user.tag}: ${reason}`
        );
        await interaction.reply({ content: `${user.tag} has been kicked.`, ephemeral: true });
        return;
      }

      if (commandName === "ban") {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? "No reason";
        await interaction.guild.members.ban(user.id, { reason });
        await sendToLogChannel(
          interaction.guild,
          `[BAN] ${user.tag} by ${interaction.user.tag}: ${reason}`
        );
        await interaction.reply({ content: `${user.tag} has been banned.`, ephemeral: true });
        return;
      }

      if (commandName === "clear") {
        if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
          await interaction.reply({ content: "Use this in a text channel.", ephemeral: true });
          return;
        }
        const amountRaw = interaction.options.getInteger("amount", true);
        const amount = Math.max(1, Math.min(100, amountRaw));
        const deleted = await interaction.channel.bulkDelete(amount, true);
        await sendToLogChannel(
          interaction.guild,
          `[CLEAR] ${interaction.user.tag} deleted ${deleted.size} messages in #${interaction.channel.name}`
        );
        await interaction.reply({
          content: `Deleted ${deleted.size} message(s).`,
          ephemeral: true,
        });
        return;
      }
    }

    if (interaction.isButton() && interaction.customId === "apply_now") {
      await interaction.deferReply({ ephemeral: true });
      const ticket = await createTicket(
        interaction,
        "Application",
        "Application submitted from panel."
      );
      await interaction.editReply({
        content: ticket ? `Application ticket created: ${ticket}` : "Could not create ticket.",
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "archive_ticket") {
      await archiveTicket(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId === "claim_order_open_modal") {
      if (interaction.inCachedGuild() && userHasFounderRole(interaction.member)) {
        const privateRoleId = interaction.guild
          ? await ensurePrivateClaimRole(interaction.guild, interaction.user.id)
          : null;
        state.claims[interaction.user.id] = {
          orderId: `FOUNDER-${Date.now()}`,
          product: "Founder",
          email: "founder@local",
          username: interaction.user.username,
          claimedAt: Date.now(),
          privateRoleId,
        };
        saveState();
        await interaction.reply({
          content: "Founder claim-order override completed.",
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("claim_order_modal")
        .setTitle("Claim Your Order");

      const orderInput = new TextInputBuilder()
        .setCustomId("order_id")
        .setLabel("Order ID")
        .setStyle(TextInputStyle.Short)
        .setMinLength(4)
        .setMaxLength(64)
        .setRequired(true);

      const noteInput = new TextInputBuilder()
        .setCustomId("order_note")
        .setLabel("Extra details")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(false);

      const emailInput = new TextInputBuilder()
        .setCustomId("claim_email")
        .setLabel("Email used on website")
        .setStyle(TextInputStyle.Short)
        .setMinLength(5)
        .setMaxLength(120)
        .setRequired(true);

      const usernameInput = new TextInputBuilder()
        .setCustomId("claim_username")
        .setLabel("Username used on website")
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(64)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(orderInput),
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(usernameInput),
        new ActionRowBuilder().addComponents(noteInput)
      );
      await interaction.showModal(modal);
      return;
    }

    if (
      interaction.isButton() &&
      (interaction.customId === "set_status_online" ||
        interaction.customId === "set_status_offline")
    ) {
      if (!interaction.inCachedGuild()) return;
      if (!userHasFounderRole(interaction.member)) {
        await interaction.reply({
          content: "Only Founder/Owner can manage runtime status.",
          ephemeral: true,
        });
        return;
      }

      state.runtime.online = interaction.customId === "set_status_online";
      if (state.runtime.online) state.runtime.since = Date.now();
      saveState();

      await interaction.reply({
        content: `Status updated to ${state.runtime.online ? "Online" : "Offline"}.`,
        ephemeral: true,
      });

      await upsertStatusMessage(interaction.guild);
      await sendToLogChannel(
        interaction.guild,
        `[STATUS] ${interaction.user.tag} set ${state.runtime.online ? "ONLINE" : "OFFLINE"}`
      );
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_action") {
      const selected = interaction.values[0];
      const labelMap = {
        support: "Support",
        claim_product: "Claim Product",
        hwid_reset: "HWID Reset",
        license_freeze: "License Freeze",
        license_unfreeze: "License Unfreeze",
      };

      if (
        interaction.inCachedGuild() &&
        userHasFounderRole(interaction.member) &&
        ["claim_product", "hwid_reset", "license_freeze", "license_unfreeze"].includes(
          selected
        )
      ) {
        if (selected === "claim_product") {
          const productNames = Object.keys(state.stock);
          const firstProduct = productNames.find((p) => (state.stock[p] ?? []).length > 0);
          if (!firstProduct) {
            await interaction.reply({
              content: "Founder override: no stock available.",
              ephemeral: true,
            });
            return;
          }
          const key = state.stock[firstProduct].shift();
          saveState();
          try {
            await interaction.user.send(
              `Founder delivery for **${firstProduct}**: \`${key}\``
            );
          } catch {
            // DM closed.
          }
          await interaction.reply({
            content: `Founder override: key sent for ${firstProduct}.`,
            ephemeral: true,
          });
          await sendTransactionLog(
            interaction.guild,
            `[FOUNDER-DELIVERY] ${interaction.user.tag} auto-claimed ${firstProduct}`
          );
          return;
        }

        state.requests.push({
          type: labelMap[selected],
          details: "Founder quick action (no input)",
          userId: interaction.user.id,
          createdAt: Date.now(),
        });
        saveState();
        await interaction.reply({
          content: `Founder override: ${labelMap[selected]} request recorded.`,
          ephemeral: true,
        });
        await sendToLogChannel(
          interaction.guild,
          `[FOUNDER-REQUEST] ${interaction.user.tag}: ${labelMap[selected]}`
        );
        return;
      }

      const selectedLabel = labelMap[selected] ?? "Support";
      const modal = new ModalBuilder()
        .setCustomId(`ticket_modal:${selected}`)
        .setTitle(`${selectedLabel} Request`);

      const detailsInput = new TextInputBuilder()
        .setCustomId("ticket_details")
        .setLabel("Describe your request")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(6)
        .setMaxLength(800)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(detailsInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal:")) {
      const selected = interaction.customId.split(":")[1];
      const labelMap = {
        support: "Support",
        claim_product: "Claim Product",
        hwid_reset: "HWID Reset",
        license_freeze: "License Freeze",
        license_unfreeze: "License Unfreeze",
      };
      const details = interaction.fields.getTextInputValue("ticket_details");
      const type = labelMap[selected] ?? "Support";
      const ticket = await createTicket(interaction, type, details);
      state.requests.push({
        type,
        details,
        userId: interaction.user.id,
        createdAt: Date.now(),
        ticketId: ticket?.id ?? null,
      });
      saveState();
      await interaction.reply({
        content: ticket
          ? `Ticket created for **${type}**: ${ticket}`
          : "Could not create ticket. Check category/channel permissions.",
      });
      await sendToLogChannel(interaction.guild, `[REQUEST] ${interaction.user.tag} | ${type} | ${details}`);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === "claim_order_modal") {
      const orderId = interaction.fields.getTextInputValue("order_id");
      const email = interaction.fields.getTextInputValue("claim_email");
      const username = interaction.fields.getTextInputValue("claim_username");
      const note = interaction.fields.getTextInputValue("order_note") || "No extra details.";

      const matchedOrder = await verifyOrderClaim({
        orderId,
        email,
        username,
      });

      if (!matchedOrder) {
        await interaction.reply({
          content:
            "Order verification failed. Order ID, email, or username did not match.",
          ephemeral: true,
        });
        return;
      }

      if (interaction.guild) {
        await ensureCustomerRole(interaction.guild, interaction.user.id);
      }
      await markOrderClaimed(orderId, interaction.user.id);
      const privateRoleId = interaction.guild
        ? await ensurePrivateClaimRole(interaction.guild, interaction.user.id)
        : null;
      state.claims[interaction.user.id] = {
        orderId,
        product: matchedOrder.product ?? "Unknown Product",
        email: matchedOrder.email ?? email,
        username: matchedOrder.username ?? username,
        claimedAt: Date.now(),
        privateRoleId,
      };
      saveState();
      await interaction.reply({
        content:
          "Claim verified. CUSTOMER access granted. You can now use Claim Product.",
        ephemeral: true,
      });
      await sendToLogChannel(
        interaction.guild,
        `[CLAIM-VERIFIED] ${interaction.user.tag} | Order ${orderId} | ${matchedOrder.product ?? "Unknown"}`
      );
      return;
    }
  } catch (error) {
    console.error("Interaction error:", error.message);
    if (interaction.isRepliable()) {
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Could not complete action. Check channel/category IDs.",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "Could not complete action. Check channel/category IDs.",
            ephemeral: true,
          });
        }
      } catch {
        // Interaction token may already be invalid/acknowledged; ignore.
      }
    }
  }
});

client.login(getRequiredEnv("DISCORD_TOKEN"));
