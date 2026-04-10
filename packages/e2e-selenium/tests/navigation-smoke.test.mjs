import test from "node:test";
import assert from "node:assert/strict";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import edge from "selenium-webdriver/edge.js";
import firefox from "selenium-webdriver/firefox.js";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:19006";
const browserName = (process.env.SELENIUM_BROWSER || "chrome").toLowerCase();
const headless = process.env.SELENIUM_HEADLESS !== "false";
const timeoutMs = Number(process.env.SELENIUM_TIMEOUT_MS || 15000);

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

async function clickByText(driver, text) {
  const element = await waitForVisible(
    driver,
    By.xpath(
      `//button//*[normalize-space(.)='${text}'] | //*[normalize-space(.)='${text}']`,
    ),
  );
  await element.click();
}

async function waitForUrlContains(driver, part) {
  await driver.wait(async () => {
    const currentUrl = await driver.getCurrentUrl();
    return currentUrl.includes(part);
  }, timeoutMs);
}

test("navigation smoke: landing Get Started goes to signup", async () => {
  const driver = buildDriver();

  try {
    await driver.get(baseUrl);

    const tagline = await waitForVisible(
      driver,
      By.xpath(
        "//*[contains(normalize-space(.), 'Find a bite with your buddies')]",
      ),
    );
    assert.ok(await tagline.isDisplayed());

    await clickByText(driver, "Get Started");
    await waitForUrlContains(driver, "/signup");

    const title = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Create account')]"),
    );
    assert.ok(await title.isDisplayed());
  } finally {
    await driver.quit();
  }
});

test("navigation smoke: login links reach forgot password and signup", async () => {
  const driver = buildDriver();

  try {
    await driver.get(`${baseUrl}/login`);

    const loginTitle = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Welcome back')]"),
    );
    assert.ok(await loginTitle.isDisplayed());

    await clickByText(driver, "Forgot password?");
    await waitForUrlContains(driver, "/forgot-password");

    const forgotTitle = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Forgot Password')]"),
    );
    assert.ok(await forgotTitle.isDisplayed());

    await driver.get(`${baseUrl}/login`);
    await clickByText(driver, "Create one →");
    await waitForUrlContains(driver, "/signup");

    const signupTitle = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Create account')]"),
    );
    assert.ok(await signupTitle.isDisplayed());
  } finally {
    await driver.quit();
  }
});

test("navigation smoke: signup Sign in link goes to login", async () => {
  const driver = buildDriver();

  try {
    await driver.get(`${baseUrl}/signup`);

    const title = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Create account')]"),
    );
    assert.ok(await title.isDisplayed());

    await clickByText(driver, "Sign in →");
    await waitForUrlContains(driver, "/login");

    const loginTitle = await waitForVisible(
      driver,
      By.xpath("//*[contains(normalize-space(.), 'Welcome back')]"),
    );
    assert.ok(await loginTitle.isDisplayed());
  } finally {
    await driver.quit();
  }
});
