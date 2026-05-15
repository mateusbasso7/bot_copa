const { SlashCommandBuilder } = require("discord.js");
const { players } = require("./game/album-service");

const countryChoices = [...new Set(players.map((player) => player.country))].sort((left, right) => left.localeCompare(right));
const playerChoices = players.map((player) => ({
  name: `${player.name} (${player.country})`,
  value: player.id
}));
const rarityChoices = [
  { name: "Comum", value: "comum" },
  { name: "Raro", value: "raro" },
  { name: "Epico", value: "epico" },
  { name: "Lendario", value: "lendario" }
];
const statusChoices = [
  { name: "Obtidas", value: "owned" },
  { name: "Faltando", value: "missing" },
  { name: "Favoritas", value: "favorite" }
];

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Verifica se o bot esta online."),
  new SlashCommandBuilder().setName("iniciar").setDescription("Cria sua colecao da Copa 2026."),
  new SlashCommandBuilder().setName("pacote").setDescription("Abre um pacote com 5 jogadores."),
  new SlashCommandBuilder()
    .setName("album")
    .setDescription("Mostra o album paginado com filtros.")
    .addStringOption((option) => addCountryChoices(option.setName("pais").setDescription("Filtrar por selecao.")))
    .addStringOption((option) => addRarityChoices(option.setName("raridade").setDescription("Filtrar por raridade.")))
    .addStringOption((option) => addStatusChoices(option.setName("status").setDescription("Filtrar por status."))),
  new SlashCommandBuilder()
    .setName("selecao")
    .setDescription("Mostra uma visao completa de uma selecao.")
    .addStringOption((option) =>
      addCountryChoices(option.setName("pais").setDescription("Selecione a selecao desejada.").setRequired(true))
    ),
  new SlashCommandBuilder().setName("repetidas").setDescription("Lista suas figurinhas repetidas."),
  new SlashCommandBuilder()
    .setName("catalogo")
    .setDescription("Preview paginado do catalogo completo.")
    .addStringOption((option) => addCountryChoices(option.setName("pais").setDescription("Filtrar por selecao.")))
    .addStringOption((option) => addRarityChoices(option.setName("raridade").setDescription("Filtrar por raridade."))),
  new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Mostra o perfil de colecionador.")
    .addUserOption((option) => option.setName("usuario").setDescription("Usuario para consultar.")),
  new SlashCommandBuilder().setName("ranking").setDescription("Mostra o ranking de colecionadores."),
  new SlashCommandBuilder().setName("conquistas").setDescription("Lista suas conquistas desbloqueadas."),
  new SlashCommandBuilder()
    .setName("favorito")
    .setDescription("Gerencia seus jogadores favoritos.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("alternar")
        .setDescription("Marca ou remove um jogador dos favoritos.")
        .addStringOption((option) =>
          addPlayerChoices(option.setName("jogador").setDescription("Jogador alvo.").setRequired(true))
        )
    )
    .addSubcommand((subcommand) => subcommand.setName("listar").setDescription("Lista seus favoritos.")),
  new SlashCommandBuilder()
    .setName("comparar")
    .setDescription("Compara sua colecao com a de outro usuario.")
    .addUserOption((option) => option.setName("usuario").setDescription("Usuario para comparar.").setRequired(true)),
  new SlashCommandBuilder()
    .setName("trocar")
    .setDescription("Cria uma proposta de troca de repetidas.")
    .addUserOption((option) => option.setName("usuario").setDescription("Destinatario da troca.").setRequired(true))
    .addStringOption((option) => addPlayerChoices(option.setName("oferecer").setDescription("Sua repetida.").setRequired(true)))
    .addStringOption((option) => addPlayerChoices(option.setName("receber").setDescription("Repetida desejada.").setRequired(true))),
  new SlashCommandBuilder().setName("historico").setDescription("Mostra seu historico de trocas.")
];

function addCountryChoices(option) {
  for (const country of countryChoices) {
    option.addChoices({ name: country, value: country });
  }
  return option;
}

function addRarityChoices(option) {
  for (const choice of rarityChoices) {
    option.addChoices(choice);
  }
  return option;
}

function addStatusChoices(option) {
  for (const choice of statusChoices) {
    option.addChoices(choice);
  }
  return option;
}

function addPlayerChoices(option) {
  for (const choice of playerChoices) {
    option.addChoices(choice);
  }
  return option;
}

module.exports = {
  commands
};
