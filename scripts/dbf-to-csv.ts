import { stringify } from "csv-stringify/sync";
import { promises as fs } from "fs";
import { DBFFile } from "dbffile";
import { existsSync, readdirSync } from "node:fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ora from "ora";
import chalk from "chalk";
import cliProgress from "cli-progress";

async function dbfToCsv() {
  const spinner = ora("⏳ Scanning source folder...").start();
  const start = Date.now();

  const options = await yargs(hideBin(process.argv))
    .usage("Usage: -s <source folder>")
    .options({
      source: {
        alias: "s",
        describe: "Source folder",
        type: "string",
        required: true,
      },
    }).argv;

  if (!existsSync(options.source)) {
    spinner.fail("❌ Source folder not found");
    throw new Error(`Source folder not found: ${options.source}`);
  }

  const files = readdirSync(options.source).filter((f) =>
    f.toLowerCase().endsWith(".dbf")
  );

  if (files.length === 0) {
    spinner.warn("⚠️ No DBF files found.");
    return;
  }

  spinner.succeed(`📂 Found ${files.length} DBF file(s).`);

  const bar = new cliProgress.SingleBar({
    format: `${chalk.cyan("{bar}")} {percentage}% | {filename}`,
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  bar.start(files.length, 0, { filename: "Starting..." });

  for (const [index, file] of files.entries()) {
    const dbfPath = path.join(options.source, file);
    const csvPath = path.join(options.source, file.replace(/\.dbf$/i, ".csv"));

    try {
      const reader = await DBFFile.open(dbfPath);
      const records = await reader.readRecords();

      if (records.length === 0) {
        bar.update(index + 1, { filename: `${file} (empty)` });
        continue;
      }

      const output = stringify(records, { header: true });
      await fs.writeFile(csvPath, output, "utf8");

      bar.update(index + 1, { filename: file });
    } catch (err) {
      bar.update(index + 1, { filename: `${file} (error)` });
      console.error(chalk.red(`❌ Error processing ${file}:`), err);
    }
  }

  bar.stop();

  const end = Date.now();
  console.log(
    chalk.green(`✅ Conversion completed in ${(end - start) / 1000}s`)
  );

  process.exit(0);
}

dbfToCsv().catch((err) => {
  console.error(chalk.red("❌ Conversion failed"));
  console.error(err);
  process.exit(1);
});
