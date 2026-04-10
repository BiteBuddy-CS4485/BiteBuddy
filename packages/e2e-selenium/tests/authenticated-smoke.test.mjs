import test from "node:test";
import assert from "node:assert/strict";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import edge from "selenium-webdriver/edge.js";
import firefox from "selenium-webdriver/firefox.js";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:19006";
const browserName = (process.env.SELENIUM_BROWSER || "chrome").toLowerCase();
const headless = process.env.SELENIUM_HEADLESS !== "false";
const timeoutMs = Number(process.env.SELENIUM_TIMEOUT_MS || 20000);

const defaultPassword = process.env.E2E_PASSWORD || "BiteBuddy123!";
const hostEmail = process.env.E2E_HOST_EMAIL || "e2e.host@bitebuddy.test";
const hostPassword = process.env.E2E_HOST_PASSWORD || defaultPassword;
const setupEmail =
  process.env.E2E_NEEDS_SETUP_EMAIL || "e2e.needs-setup@bitebuddy.test";
const setupPassword = process.env.E2E_NEEDS_SETUP_PASSWORD || defaultPassword;

function buildDriver() {
  if (browserName === "firefox") {
    const options = new firefox.Options();
    if (headless) {
      options.addArguments("-headless");
    }
    return new Builder()
      .forBrowser("firefox")
      .setFirefoxOptions(options)
      .build();
  }

  if (browserName === "edge") {
    const options = new edge.Options();
    if (headless) {
      options.addArguments("--headless=new", "--window-size=1280,900");
    }
    return new Builder()
      .forBrowser("MicrosoftEdge")
      .setEdgeOptions(options)
      .build();
  }

  const options = new chrome.Options();
  if (headless) {
    options.addArguments("--headless=new", "--window-size=1280,900");
  }
  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

async function waitForVisible(driver, locator) {
  const element = await driver.wait(until.elementLocated(locator), timeoutMs);
  await driver.wait(until.elementIsVisible(element), timeoutMs);
  return element;
}

async function hasVisibleText(driver, text) {
  const elements = await driver.findElements(
    By.xpath(`//*[contains(normalize-space(.), '${text}')]`),
  );

  for (const element of elements) {
    if (await element.isDisplayed()) {
      return true;
    }
  }

  return false;
}

async function loginAs(driver, email, password) {
  await driver.get(`${baseUrl}/login`);

  await waitForVisible(
    driver,
    By.xpath("//*[contains(normalize-space(.), 'Welcome back')]"),
  );

  const inputs = await driver.findElements(By.css("input"));
  assert.ok(inputs.length >= 2, "Expected email and password inputs");

  await inputs[0].clear();
  await inputs[0].sendKeys(email);
  await inputs[1].clear();
  await inputs[1].sendKeys(password);

  const signIn = await waitForVisible(
    driver,
    By.xpath(
      "//button//*[normalize-space(.)='Sign In'] | //*[normalize-space(.)='Sign In']",
    ),
  );
  await signIn.click();

  await driver.wait(async () => {
    const checks = await Promise.all([
      hasVisibleText(driver, "Ready to find where to eat tonight"),
      hasVisibleText(driver, "Welcome!"),
      hasVisibleText(driver, "Choose a username to get started"),
    ]);
    return checks.some(Boolean);
  }, timeoutMs);
}

test("authenticated smoke: seeded host can login and see home", async () => {
  const driver = buildDriver();

  try {
    await loginAs(driver, hostEmail, hostPassword);

    const greeting = await waitForVisible(
      driver,
      By.xpath(
        "//*[contains(normalize-space(.), 'Ready to find where to eat tonight')]",
      ),
    );
    assert.ok(await greeting.isDisplayed());
  } finally {
    await driver.quit();
  }
});

test("authenticated smoke: seeded host can open friends tab", async () => {
  const driver = buildDriver();

  try {
    await loginAs(driver, hostEmail, hostPassword);
    await driver.get(`${baseUrl}/friends`);

    await driver.wait(async () => {
      const currentUrl = await driver.getCurrentUrl();
      return currentUrl.includes("/friends");
    }, timeoutMs);

    const currentUrl = await driver.getCurrentUrl();
    assert.ok(
      currentUrl.includes("/friends"),
      `Expected to be on /friends route, got ${currentUrl}`,
    );
  } finally {
    await driver.quit();
  }
});

test("authenticated smoke: seeded setup user is routed to profile setup", async () => {
  const driver = buildDriver();

  try {
    await loginAs(driver, setupEmail, setupPassword);

    const profileSetupTitle = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Welcome!')]"),
    );
    assert.ok(await profileSetupTitle.isDisplayed());

    const profileSetupSubtitle = await waitForVisible(
      driver,
      By.xpath(
        "//*[contains(normalize-space(.), 'Choose a username to get started')]",
      ),
    );
    assert.ok(await profileSetupSubtitle.isDisplayed());
  } finally {
    await driver.quit();
  }
});
